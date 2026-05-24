import { Router } from 'express';
import { requireAuth, requireWorkspaceRole } from '../../auth/auth.middleware.js';
import * as workspaceController from './workspace.controller.js';
const router = Router();
// Public route to inspect/preview invitation details
router.get('/invite/:token', workspaceController.getInvitePreview);
// All other workspace endpoints require a valid session
router.post('/invite/:token/accept', requireAuth, workspaceController.acceptInvite);
router.post('/', requireAuth, workspaceController.createWorkspace);
router.get('/', requireAuth, workspaceController.listWorkspaces);
// Workspace specific endpoints with RBAC guards
router.get('/:id', requireAuth, requireWorkspaceRole(['owner', 'admin', 'member', 'viewer']), workspaceController.getWorkspace);
router.patch('/:id', requireAuth, requireWorkspaceRole(['owner', 'admin']), workspaceController.updateWorkspace);
router.delete('/:id', requireAuth, requireWorkspaceRole(['owner']), workspaceController.deleteWorkspace);
// Member Management
router.post('/:id/invite', requireAuth, requireWorkspaceRole(['owner', 'admin']), workspaceController.inviteMember);
router.get('/:id/members', requireAuth, requireWorkspaceRole(['owner', 'admin', 'member', 'viewer']), workspaceController.listMembers);
router.patch('/:id/members/:uid', requireAuth, requireWorkspaceRole(['owner', 'admin']), workspaceController.changeMemberRole);
router.delete('/:id/members/:uid', requireAuth, requireWorkspaceRole(['owner', 'admin']), workspaceController.removeMember);
export { router as workspaceRoutes };
