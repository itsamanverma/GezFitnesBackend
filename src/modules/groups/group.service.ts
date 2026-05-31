import { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Group } from './group.model.js';
import { GroupMember } from './groupMember.model.js';
import { GroupInvite } from './groupInvite.model.js';
import { 
  NotFoundError, 
  BadRequestError, 
  ConflictError, 
  ForbiddenError, 
  GoneError 
} from '../../utils/errors.js';

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-');        // Replace multiple - with single -
}

export const GroupService = {
  async create(
    userId: string,
    name: string,
    type: 'open' | 'invite',
    description?: string,
    avatar?: string
  ) {
    if (!name || !type) {
      throw new BadRequestError('Name and type are required');
    }

    const baseSlug = slugify(name);
    let slug = baseSlug;
    let counter = 1;
    
    // Check slug uniqueness
    while (await Group.findOne({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const group = await Group.create({
      name,
      slug,
      type,
      creatorId: new Types.ObjectId(userId),
      description,
      avatar,
      memberCount: 1,
      isActive: true
    });

    // Creator automatically becomes an active admin member
    await GroupMember.create({
      groupId: group._id,
      userId: new Types.ObjectId(userId),
      role: 'admin',
      status: 'active'
    });

    return group;
  },

  async join(groupIdStr: string, userIdStr: string) {
    if (!Types.ObjectId.isValid(groupIdStr)) {
      throw new BadRequestError('Invalid group ID');
    }

    const groupId = new Types.ObjectId(groupIdStr);
    const userId = new Types.ObjectId(userIdStr);

    const group = await Group.findOne({ _id: groupId, isActive: true });
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    if (group.type === 'invite') {
      throw new ForbiddenError('This group is invite-only. You must use an invite token to join.');
    }

    const existingMember = await GroupMember.findOne({ groupId, userId });
    if (existingMember) {
      if (existingMember.status === 'active') {
        throw new ConflictError('You are already a member of this group');
      } else {
        // Reactivate suspended membership
        existingMember.status = 'active';
        existingMember.joinedAt = new Date();
        await existingMember.save();
        
        group.memberCount = await GroupMember.countDocuments({ groupId, status: 'active' });
        await group.save();
        return existingMember;
      }
    }

    const member = await GroupMember.create({
      groupId,
      userId,
      role: 'member',
      status: 'active'
    });

    group.memberCount = await GroupMember.countDocuments({ groupId, status: 'active' });
    await group.save();

    return member;
  },

  async joinByToken(token: string, userIdStr: string) {
    if (!token) {
      throw new BadRequestError('Invite token is required');
    }

    const userId = new Types.ObjectId(userIdStr);

    const invite = await GroupInvite.findOne({ token });
    if (!invite) {
      throw new NotFoundError('Invite token not found');
    }

    if (invite.expiresAt < new Date()) {
      throw new GoneError('This invite token has expired');
    }

    const group = await Group.findOne({ _id: invite.groupId, isActive: true });
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    const existingMember = await GroupMember.findOne({ groupId: invite.groupId, userId });
    if (existingMember) {
      if (existingMember.status === 'active') {
        throw new ConflictError('You are already a member of this group');
      } else {
        existingMember.status = 'active';
        existingMember.joinedAt = new Date();
        await existingMember.save();
        
        group.memberCount = await GroupMember.countDocuments({ groupId: invite.groupId, status: 'active' });
        await group.save();
        return existingMember;
      }
    }

    const member = await GroupMember.create({
      groupId: invite.groupId,
      userId,
      role: 'member',
      status: 'active'
    });

    group.memberCount = await GroupMember.countDocuments({ groupId: invite.groupId, status: 'active' });
    await group.save();

    return member;
  },

  async createInvite(groupIdStr: string, adminUserIdStr: string) {
    if (!Types.ObjectId.isValid(groupIdStr)) {
      throw new BadRequestError('Invalid group ID');
    }

    const groupId = new Types.ObjectId(groupIdStr);
    const adminUserId = new Types.ObjectId(adminUserIdStr);

    // Verify requesting user is admin of this group
    const adminMember = await GroupMember.findOne({ 
      groupId, 
      userId: adminUserId, 
      role: 'admin', 
      status: 'active' 
    });

    if (!adminMember) {
      throw new ForbiddenError('Only group administrators can generate invite links');
    }

    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    const invite = await GroupInvite.create({
      groupId,
      token,
      createdBy: adminUserId,
      expiresAt
    });

    return invite;
  },

  async list(query?: string) {
    const filter: any = { type: 'open', isActive: true };
    if (query) {
      filter.name = { $regex: query, $options: 'i' };
    }
    return Group.find(filter).select('-creatorId');
  },

  async getDetails(groupIdStr: string, userIdStr: string) {
    if (!Types.ObjectId.isValid(groupIdStr)) {
      throw new BadRequestError('Invalid group ID');
    }

    const groupId = new Types.ObjectId(groupIdStr);
    const userId = new Types.ObjectId(userIdStr);

    const group = await Group.findOne({ _id: groupId, isActive: true });
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    const membership = await GroupMember.findOne({ groupId, userId, status: 'active' });

    // Enforce private/invite-only view restriction: non-members cannot view private groups
    if (group.type === 'invite' && !membership) {
      throw new ForbiddenError('You do not have access to view this group details');
    }

    return {
      group,
      membership: membership ? { role: membership.role, joinedAt: membership.joinedAt } : null
    };
  },

  async checkMembership(groupId: Types.ObjectId | string, userId: Types.ObjectId | string): Promise<boolean> {
    const member = await GroupMember.findOne({
      groupId: new Types.ObjectId(groupId),
      userId: new Types.ObjectId(userId),
      status: 'active'
    });
    return !!member;
  }
};
