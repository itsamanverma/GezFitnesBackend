import { Workspace, WorkspaceMember, WorkspaceInvite } from './workspace.model.js';
import { User } from '../user/user.model.js';
import { redisClient } from '../../config/redis.js';
import { emailQueue } from '../../jobs/queue.js';
import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, ConflictError, ForbiddenError, GoneError, BadRequestError } from '../../utils/errors.js';
import { env } from '../../config/env.js';
import mongoose from 'mongoose';

// Generate unique slug
async function generateUniqueSlug(name: string): Promise<string> {
  const baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word characters
    .replace(/[\s_-]+/g, '-')  // Replace spaces/underscores with single hyphen
    .replace(/^-+|-+$/g, '');  // Trim leading/trailing hyphens

  let slug = baseSlug || 'workspace';
  let counter = 1;
  
  while (true) {
    const existing = await Workspace.findOne({ slug });
    if (!existing) {
      return slug;
    }
    counter++;
    slug = `${baseSlug}-${counter}`;
  }
}

export async function createWorkspace(userId: string, name: string) {
  const slug = await generateUniqueSlug(name);

  // 1. Create Workspace
  const workspace = new Workspace({
    name,
    slug,
    ownerId: userId,
  });
  await workspace.save();

  // 2. Add Owner as Member
  const member = new WorkspaceMember({
    workspaceId: workspace._id,
    userId,
    role: 'owner',
  });
  await member.save();

  return workspace;
}

export async function getWorkspaceById(workspaceId: string, userId: string) {
  const cacheKey = `cache:workspace:${workspaceId}`;

  // Ensure user is member of this workspace
  const member = await WorkspaceMember.findOne({ workspaceId, userId });
  if (!member) {
    throw new ForbiddenError('You are not a member of this workspace');
  }

  // Check Redis cache
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    // Ignore cache error
  }

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    throw new NotFoundError('Workspace not found');
  }

  // Cache for 10 minutes (600s)
  try {
    await redisClient.setex(cacheKey, 600, JSON.stringify(workspace));
  } catch (err) {
    // Ignore cache error
  }

  return workspace;
}

export async function listWorkspaces(userId: string) {
  const memberships = await WorkspaceMember.find({ userId });
  const workspaceIds = memberships.map((m) => m.workspaceId);
  return Workspace.find({ _id: { $in: workspaceIds } });
}

export async function updateWorkspace(workspaceId: string, userId: string, data: any) {
  // Ensure user is owner or admin to update settings
  const member = await WorkspaceMember.findOne({ workspaceId, userId });
  if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
    throw new ForbiddenError('Insufficient workspace permissions');
  }

  const workspace = await Workspace.findByIdAndUpdate(
    workspaceId,
    { $set: data },
    { new: true }
  );

  if (!workspace) {
    throw new NotFoundError('Workspace not found');
  }

  // Invalidate Redis cache
  try {
    await redisClient.del(`cache:workspace:${workspaceId}`);
  } catch (err) {
    // Ignore cache error
  }

  return workspace;
}

export async function deleteWorkspace(workspaceId: string, userId: string) {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    throw new NotFoundError('Workspace not found');
  }

  // Only owner can delete workspace
  if (workspace.ownerId !== userId) {
    throw new ForbiddenError('Only the workspace owner can delete it');
  }

  // Delete workspace members
  await WorkspaceMember.deleteMany({ workspaceId });
  // Delete workspace invites
  await WorkspaceInvite.deleteMany({ workspaceId });
  // Delete workspace itself
  await Workspace.deleteOne({ _id: workspaceId });

  // Invalidate Redis cache
  try {
    await redisClient.del(`cache:workspace:${workspaceId}`);
  } catch (err) {
    // Ignore cache error
  }

  return true;
}

export async function inviteMember(
  workspaceId: string,
  inviterId: string,
  email: string,
  role: 'admin' | 'member' | 'viewer'
) {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    throw new NotFoundError('Workspace not found');
  }

  // Check if user is already a member
  const user = await User.findOne({ email });
  if (user) {
    const isMember = await WorkspaceMember.findOne({ workspaceId, userId: user.id || user._id });
    if (isMember) {
      throw new ConflictError('User is already a member of this workspace', 'ALREADY_MEMBER');
    }
  }

  // Check if pending invite exists for this email
  let invite = await WorkspaceInvite.findOne({ workspaceId, email });
  let token = '';

  if (invite) {
    // Update TTL / resend
    invite.createdAt = new Date();
    token = invite.token;
    await invite.save();
  } else {
    token = uuidv4();
    invite = new WorkspaceInvite({
      workspaceId,
      email,
      role,
      token,
      invitedBy: inviterId,
    });
    await invite.save();
  }

  // Enqueue email job
  const acceptLink = `${env.APP_URL}/v1/workspaces/invite/${token}`;
  await emailQueue.add('send-email', {
    to: email,
    subject: `Invitation to join workspace ${workspace.name}`,
    html: `
      <h2>You've been invited!</h2>
      <p>You have been invited to join the workspace <strong>${workspace.name}</strong> as a <strong>${role}</strong>.</p>
      <p>Click the link below to accept this invitation (valid for 48 hours):</p>
      <a href="${acceptLink}" style="display:inline-block;padding:10px 20px;color:white;background-color:#007bff;text-decoration:none;border-radius:5px;">Accept Invitation</a>
      <p>If you don't have an account yet, please sign up using this email first.</p>
    `,
  });

  return invite;
}

export async function getInviteByToken(token: string) {
  const invite = await WorkspaceInvite.findOne({ token });
  if (!invite) {
    throw new NotFoundError('Invitation token not found');
  }

  // Manual check for TTL in case MongoDB index hasn't run yet
  const isExpired = invite.createdAt.getTime() + 172800 * 1000 < Date.now();
  if (isExpired) {
    await WorkspaceInvite.deleteOne({ _id: invite._id });
    throw new GoneError('Invitation has expired');
  }

  const workspace = await Workspace.findById(invite.workspaceId);
  if (!workspace) {
    throw new NotFoundError('Workspace not found');
  }

  return {
    invite,
    workspace: {
      name: workspace.name,
      slug: workspace.slug,
    },
  };
}

export async function acceptInvite(token: string, user: any) {
  const invite = await WorkspaceInvite.findOne({ token });
  if (!invite) {
    throw new NotFoundError('Invitation token not found');
  }

  const isExpired = invite.createdAt.getTime() + 172800 * 1000 < Date.now();
  if (isExpired) {
    await WorkspaceInvite.deleteOne({ _id: invite._id });
    throw new GoneError('Invitation has expired');
  }

  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new ForbiddenError('This invite was sent to a different email address', 'EMAIL_MISMATCH');
  }

  const workspace = await Workspace.findById(invite.workspaceId);
  if (!workspace) {
    throw new NotFoundError('Workspace not found');
  }

  // Check if member already exists
  const existingMember = await WorkspaceMember.findOne({
    workspaceId: invite.workspaceId,
    userId: user.id || user._id,
  });

  if (existingMember) {
    await WorkspaceInvite.deleteOne({ _id: invite._id });
    throw new ConflictError('You are already a member of this workspace');
  }

  // Add member record
  const member = new WorkspaceMember({
    workspaceId: invite.workspaceId,
    userId: user.id || user._id,
    role: invite.role,
    invitedBy: invite.invitedBy,
  });
  await member.save();

  // Clean up invitation
  await WorkspaceInvite.deleteOne({ _id: invite._id });

  return { workspace, role: invite.role };
}

export async function listMembers(workspaceId: string) {
  const members = await WorkspaceMember.find({ workspaceId }).lean();
  
  // Fetch user profiles for workspace members
  const userIds = members.map((m) => m.userId);
  const users = await User.find({ _id: { $in: userIds } });
  
  const usersMap = new Map(users.map((u) => [u._id.toString(), u]));

  return members.map((m) => ({
    ...m,
    user: usersMap.get(m.userId) || null,
  }));
}

export async function changeMemberRole(
  workspaceId: string,
  changerId: string,
  memberUserId: string,
  newRole: 'admin' | 'member' | 'viewer'
) {
  // 1. RBAC Guard on Changer
  const changer = await WorkspaceMember.findOne({ workspaceId, userId: changerId });
  if (!changer || (changer.role !== 'owner' && changer.role !== 'admin')) {
    throw new ForbiddenError('Only owners and admins can manage roles');
  }

  // 2. Find target member
  const targetMember = await WorkspaceMember.findOne({ workspaceId, userId: memberUserId });
  if (!targetMember) {
    throw new NotFoundError('Member not found in workspace');
  }

  // 3. Prevent operations on Owner
  if (targetMember.role === 'owner') {
    throw new BadRequestError('Cannot modify the role of the workspace owner', 'CANNOT_DEMOTE_OWNER');
  }

  // 4. Prevent modifying self
  if (memberUserId === changerId) {
    throw new BadRequestError('Cannot change your own role', 'CANNOT_CHANGE_OWN_ROLE');
  }

  // 5. Admins can only set roles to member or viewer
  if (changer.role === 'admin' && newRole === 'admin') {
    throw new ForbiddenError('Admins cannot grant admin permissions');
  }

  // 6. Update role
  targetMember.role = newRole;
  await targetMember.save();

  return targetMember;
}

export async function removeMember(workspaceId: string, changerId: string, memberUserId: string) {
  // 1. RBAC Guard on Changer
  const changer = await WorkspaceMember.findOne({ workspaceId, userId: changerId });
  if (!changer || (changer.role !== 'owner' && changer.role !== 'admin')) {
    throw new ForbiddenError('Only owners and admins can remove members');
  }

  // 2. Find target member
  const targetMember = await WorkspaceMember.findOne({ workspaceId, userId: memberUserId });
  if (!targetMember) {
    throw new NotFoundError('Member not found in workspace');
  }

  // 3. Cannot remove Owner
  if (targetMember.role === 'owner') {
    throw new BadRequestError('Cannot remove the workspace owner');
  }

  // 4. Cannot remove self (must use leave endpoint or own logic)
  if (memberUserId === changerId) {
    throw new BadRequestError('Cannot remove yourself from the workspace');
  }

  // 5. Admin cannot remove another admin
  if (changer.role === 'admin' && targetMember.role === 'admin') {
    throw new ForbiddenError('Admins cannot remove other admins');
  }

  await WorkspaceMember.deleteOne({ _id: targetMember._id });
  return true;
}
