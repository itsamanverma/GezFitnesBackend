import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { Group } from '../../src/modules/groups/group.model.js';
import { GroupMember } from '../../src/modules/groups/groupMember.model.js';
import { GroupInvite } from '../../src/modules/groups/groupInvite.model.js';
import { LiveSession } from '../../src/modules/liveSessions/liveSession.model.js';
import { disconnectDb } from '../../src/config/db.js';
import { redisClient } from '../../src/config/redis.js';
describe('Group & Activity Sharing Integration Tests', () => {
    const adminId = '507f1f77bcf86cd799439011';
    const memberId = '507f1f77bcf86cd799439022';
    const outsiderId = '507f1f77bcf86cd799439033';
    beforeAll(async () => {
        await Group.deleteMany({});
        await GroupMember.deleteMany({});
        await GroupInvite.deleteMany({});
        await LiveSession.deleteMany({});
    });
    afterAll(async () => {
        await Group.deleteMany({});
        await GroupMember.deleteMany({});
        await GroupInvite.deleteMany({});
        await LiveSession.deleteMany({});
        await redisClient.quit();
        await disconnectDb();
    });
    let openGroupId;
    let inviteGroupId;
    let inviteToken;
    it('should create an open group and auto-generate slug', async () => {
        const res = await request(app)
            .post('/v1/groups')
            .set('x-test-user-id', adminId)
            .send({
            name: 'Running Legends',
            type: 'open',
            description: 'A group for the fastest runners.'
        });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.name).toBe('Running Legends');
        expect(res.body.data.slug).toBe('running-legends');
        expect(res.body.data.type).toBe('open');
        openGroupId = res.body.data._id;
        // Check creator was added as admin
        const member = await GroupMember.findOne({ groupId: openGroupId, userId: adminId });
        expect(member).toBeDefined();
        expect(member?.role).toBe('admin');
        expect(member?.status).toBe('active');
    });
    it('should handle duplicate slugs on group creation', async () => {
        const res = await request(app)
            .post('/v1/groups')
            .set('x-test-user-id', outsiderId)
            .send({
            name: 'Running Legends',
            type: 'open'
        });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.slug).toBe('running-legends-1');
    });
    it('should list open groups', async () => {
        const res = await request(app)
            .get('/v1/groups')
            .set('x-test-user-id', memberId);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
    it('should allow user to join an open group directly', async () => {
        const res = await request(app)
            .post(`/v1/groups/${openGroupId}/join`)
            .set('x-test-user-id', memberId)
            .send();
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.userId).toBe(memberId);
        expect(res.body.data.role).toBe('member');
        const group = await Group.findById(openGroupId);
        expect(group?.memberCount).toBe(2);
    });
    it('should create an invite-only group', async () => {
        const res = await request(app)
            .post('/v1/groups')
            .set('x-test-user-id', adminId)
            .send({
            name: 'Secret Cycling Club',
            type: 'invite',
            description: 'By invite only.'
        });
        expect(res.status).toBe(201);
        expect(res.body.data.type).toBe('invite');
        inviteGroupId = res.body.data._id;
    });
    it('should deny direct joining of invite-only groups', async () => {
        const res = await request(app)
            .post(`/v1/groups/${inviteGroupId}/join`)
            .set('x-test-user-id', memberId)
            .send();
        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('FORBIDDEN');
    });
    it('should deny viewing details of private group if not a member', async () => {
        const res = await request(app)
            .get(`/v1/groups/${inviteGroupId}`)
            .set('x-test-user-id', memberId);
        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('FORBIDDEN');
    });
    it('should allow admin to create an invite token', async () => {
        const res = await request(app)
            .post(`/v1/groups/${inviteGroupId}/invites`)
            .set('x-test-user-id', adminId)
            .send();
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.token).toBeDefined();
        inviteToken = res.body.data.token;
    });
    it('should allow joining invite-only group via valid token', async () => {
        const res = await request(app)
            .post(`/v1/groups/join/${inviteToken}`)
            .set('x-test-user-id', memberId)
            .send();
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.role).toBe('member');
        // User should now be able to fetch group details
        const detailRes = await request(app)
            .get(`/v1/groups/${inviteGroupId}`)
            .set('x-test-user-id', memberId);
        expect(detailRes.status).toBe(200);
        expect(detailRes.body.data.group.name).toBe('Secret Cycling Club');
    });
    it('should deny non-members from generating invites', async () => {
        const res = await request(app)
            .post(`/v1/groups/${inviteGroupId}/invites`)
            .set('x-test-user-id', outsiderId)
            .send();
        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('FORBIDDEN');
    });
    it('should reject starting a live session with group ID if user is not a member', async () => {
        const res = await request(app)
            .post('/v1/live-sessions/start')
            .set('x-test-user-id', outsiderId)
            .send({
            activityType: 'RUN',
            groupId: inviteGroupId
        });
        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('NOT_GROUP_MEMBER');
    });
    it('should allow starting a live session with group ID if user is a member', async () => {
        const res = await request(app)
            .post('/v1/live-sessions/start')
            .set('x-test-user-id', memberId)
            .send({
            activityType: 'RUN',
            groupId: inviteGroupId
        });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.sessionId).toBeDefined();
        // Verify session in DB contains the groupId
        const session = await LiveSession.findOne({ sessionId: res.body.data.sessionId });
        expect(session?.groupId?.toString()).toBe(inviteGroupId);
    });
});
