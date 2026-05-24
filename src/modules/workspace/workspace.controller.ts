import { Request, Response, NextFunction } from 'express';
import * as workspaceService from './workspace.service.js';
import { CreateWorkspaceSchema, UpdateWorkspaceSchema, InviteMemberSchema, ChangeRoleSchema } from './workspace.schema.js';
import { success } from '../../utils/response.js';
import { ValidationError } from '../../utils/errors.js';

export async function createWorkspace(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = CreateWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Validation failed', parsed.error.format());
    }

    const workspace = await workspaceService.createWorkspace(req.user.id, parsed.data.name);
    return success(res, workspace, 'Workspace created successfully', 201);
  } catch (err) {
    next(err);
  }
}

export async function listWorkspaces(req: Request, res: Response, next: NextFunction) {
  try {
    const workspaces = await workspaceService.listWorkspaces(req.user.id);
    return success(res, workspaces);
  } catch (err) {
    next(err);
  }
}

export async function getWorkspace(req: Request, res: Response, next: NextFunction) {
  try {
    const workspace = await workspaceService.getWorkspaceById(req.params.id, req.user.id);
    return success(res, workspace);
  } catch (err) {
    next(err);
  }
}

export async function updateWorkspace(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = UpdateWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Validation failed', parsed.error.format());
    }

    const workspace = await workspaceService.updateWorkspace(req.params.id, req.user.id, parsed.data);
    return success(res, workspace, 'Workspace updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function deleteWorkspace(req: Request, res: Response, next: NextFunction) {
  try {
    await workspaceService.deleteWorkspace(req.params.id, req.user.id);
    return success(res, null, 'Workspace deleted successfully');
  } catch (err) {
    next(err);
  }
}

export async function inviteMember(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = InviteMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Validation failed', parsed.error.format());
    }

    await workspaceService.inviteMember(req.params.id, req.user.id, parsed.data.email, parsed.data.role);
    return success(res, null, 'Invite sent successfully');
  } catch (err) {
    next(err);
  }
}

export async function getInvitePreview(req: Request, res: Response, next: NextFunction) {
  try {
    const inviteDetails = await workspaceService.getInviteByToken(req.params.token);
    return success(res, inviteDetails);
  } catch (err) {
    next(err);
  }
}

export async function acceptInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await workspaceService.acceptInvite(req.params.token, req.user);
    return success(res, result, 'Invitation accepted successfully');
  } catch (err) {
    next(err);
  }
}

export async function listMembers(req: Request, res: Response, next: NextFunction) {
  try {
    const members = await workspaceService.listMembers(req.params.id);
    return success(res, members);
  } catch (err) {
    next(err);
  }
}

export async function changeMemberRole(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = ChangeRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Validation failed', parsed.error.format());
    }

    const member = await workspaceService.changeMemberRole(req.params.id, req.user.id, req.params.uid, parsed.data.role);
    return success(res, member, 'Member role updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function removeMember(req: Request, res: Response, next: NextFunction) {
  try {
    await workspaceService.removeMember(req.params.id, req.user.id, req.params.uid);
    return success(res, null, 'Member removed successfully');
  } catch (err) {
    next(err);
  }
}
