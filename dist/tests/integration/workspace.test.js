import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { Workspace, WorkspaceMember, WorkspaceInvite } from '../../src/modules/workspace/workspace.model.js';
import { User } from '../../src/modules/user/user.model.js';
import { disconnectDb } from '../../src/config/db.js';
import { redisClient } from '../../src/config/redis.js';
describe('Workspace Integration Tests', () => {
    const ownerId = 'user-owner-123';
    const adminId = 'user-admin-456';
    const viewerId = 'user-viewer-789';
    const strangerId = 'user-stranger-999';
    let workspaceId;
    beforeAll(async () => {
        // Clean up only test suite specific data
        await Workspace.deleteMany({ ownerId: { $in: [ownerId, adminId, viewerId, strangerId] } });
        await WorkspaceMember.deleteMany({ userId: { $in: [ownerId, adminId, viewerId, strangerId] } });
        await WorkspaceInvite.deleteMany({ invitedBy: { $in: [ownerId, adminId, viewerId, strangerId] } });
        await User.deleteMany({ _id: { $in: [ownerId, adminId, viewerId, strangerId] } });
        // Create test users
        await User.create([
            { _id: ownerId, name: 'Owner User', email: 'owner@example.com', emailVerified: true },
            { _id: adminId, name: 'Admin User', email: 'admin@example.com', emailVerified: true },
            { _id: viewerId, name: 'Viewer User', email: 'viewer@example.com', emailVerified: true },
            { _id: strangerId, name: 'Stranger User', email: 'stranger@example.com', emailVerified: true },
        ]);
    });
    afterAll(async () => {
        await Workspace.deleteMany({ ownerId: { $in: [ownerId, adminId, viewerId, strangerId] } });
        await WorkspaceMember.deleteMany({ userId: { $in: [ownerId, adminId, viewerId, strangerId] } });
        await WorkspaceInvite.deleteMany({ invitedBy: { $in: [ownerId, adminId, viewerId, strangerId] } });
        await User.deleteMany({ _id: { $in: [ownerId, adminId, viewerId, strangerId] } });
        await redisClient.quit();
        await disconnectDb();
    });
    it('should create a workspace and make the creator the owner', async () => {
        const res = await request(app)
            .post('/v1/workspaces')
            .set('x-test-user-id', ownerId)
            .set('x-test-user-email', 'owner@example.com')
            .send({ name: 'Acme Corp' });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.name).toBe('Acme Corp');
        expect(res.body.data.slug).toBe('acme-corp');
        expect(res.body.data.ownerId).toBe(ownerId);
        workspaceId = res.body.data._id;
        // Check membership
        const member = await WorkspaceMember.findOne({ workspaceId, userId: ownerId });
        expect(member).toBeDefined();
        expect(member.role).toBe('owner');
    });
    it('should list workspaces for the user', async () => {
        const res = await request(app)
            .get('/v1/workspaces')
            .set('x-test-user-id', ownerId);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].name).toBe('Acme Corp');
    });
    it('should allow members to get workspace details', async () => {
        const res = await request(app)
            .get(`/v1/workspaces/${workspaceId}`)
            .set('x-test-user-id', ownerId);
        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('Acme Corp');
    });
    it('should deny non-members from getting workspace details', async () => {
        const res = await request(app)
            .get(`/v1/workspaces/${workspaceId}`)
            .set('x-test-user-id', strangerId);
        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
    });
    it('should allow owner to invite members', async () => {
        const res = await request(app)
            .post(`/v1/workspaces/${workspaceId}/invite`)
            .set('x-test-user-id', ownerId)
            .send({ email: 'admin@example.com', role: 'admin' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        const invite = await WorkspaceInvite.findOne({ workspaceId, email: 'admin@example.com' });
        expect(invite).toBeDefined();
        expect(invite.role).toBe('admin');
    });
    it('should allow retrieving invite preview publicly', async () => {
        const invite = await WorkspaceInvite.findOne({ workspaceId, email: 'admin@example.com' });
        const res = await request(app).get(`/v1/workspaces/invite/${invite.token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.workspace.name).toBe('Acme Corp');
        expect(res.body.data.invite.role).toBe('admin');
    });
    it('should allow accepting invitation', async () => {
        const invite = await WorkspaceInvite.findOne({ workspaceId, email: 'admin@example.com' });
        const res = await request(app)
            .post(`/v1/workspaces/invite/${invite.token}/accept`)
            .set('x-test-user-id', adminId)
            .set('x-test-user-email', 'admin@example.com');
        expect(res.status).toBe(200);
        expect(res.body.data.role).toBe('admin');
        const member = await WorkspaceMember.findOne({ workspaceId, userId: adminId });
        expect(member).toBeDefined();
        expect(member.role).toBe('admin');
    });
    it('should allow admin to invite viewer', async () => {
        // Add viewer user invitation
        const inviteRes = await request(app)
            .post(`/v1/workspaces/${workspaceId}/invite`)
            .set('x-test-user-id', adminId)
            .send({ email: 'viewer@example.com', role: 'viewer' });
        expect(inviteRes.status).toBe(200);
        const invite = await WorkspaceInvite.findOne({ workspaceId, email: 'viewer@example.com' });
        // Accept invitation
        const acceptRes = await request(app)
            .post(`/v1/workspaces/invite/${invite.token}/accept`)
            .set('x-test-user-id', viewerId)
            .set('x-test-user-email', 'viewer@example.com');
        expect(acceptRes.status).toBe(200);
    });
    it('should block viewer from admin actions (e.g. invite)', async () => {
        const res = await request(app)
            .post(`/v1/workspaces/${workspaceId}/invite`)
            .set('x-test-user-id', viewerId)
            .send({ email: 'random@example.com', role: 'member' });
        expect(res.status).toBe(403);
    });
    it('should allow owner to change roles and remove members', async () => {
        // Change role of admin to viewer
        const patchRes = await request(app)
            .patch(`/v1/workspaces/${workspaceId}/members/${adminId}`)
            .set('x-test-user-id', ownerId)
            .send({ role: 'viewer' });
        expect(patchRes.status).toBe(200);
        expect(patchRes.body.data.role).toBe('viewer');
        // Remove member
        const deleteRes = await request(app)
            .delete(`/v1/workspaces/${workspaceId}/members/${adminId}`)
            .set('x-test-user-id', ownerId);
        expect(deleteRes.status).toBe(200);
        const member = await WorkspaceMember.findOne({ workspaceId, userId: adminId });
        expect(member).toBeNull();
    });
    it('should allow owner to delete workspace', async () => {
        const res = await request(app)
            .delete(`/v1/workspaces/${workspaceId}`)
            .set('x-test-user-id', ownerId);
        expect(res.status).toBe(200);
        const workspace = await Workspace.findById(workspaceId);
        expect(workspace).toBeNull();
    });
});
