import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { User } from '../../src/modules/user/user.model.js';
import { Friendship } from '../../src/modules/friends/friendship.model.js';
import { disconnectDb } from '../../src/config/db.js';
import { redisClient } from '../../src/config/redis.js';
describe('Friend System Integration Tests', () => {
    const user1Id = '507f1f77bcf86cd799439044';
    const user2Id = '507f1f77bcf86cd799439055';
    const user3Id = '507f1f77bcf86cd799439066';
    beforeAll(async () => {
        // Clear and seed test users
        await User.deleteMany({ _id: { $in: [user1Id, user2Id, user3Id] } });
        await Friendship.deleteMany({});
        await User.create([
            { _id: user1Id, name: 'User One', email: 'user1@example.com', emailVerified: true },
            { _id: user2Id, name: 'User Two', email: 'user2@example.com', emailVerified: true },
            { _id: user3Id, name: 'User Three', email: 'user3@example.com', emailVerified: true }
        ]);
    });
    afterAll(async () => {
        await User.deleteMany({ _id: { $in: [user1Id, user2Id, user3Id] } });
        await Friendship.deleteMany({});
        await redisClient.quit();
        await disconnectDb();
    });
    let requestId;
    it('should send a friend request from User One to User Two by Email', async () => {
        const res = await request(app)
            .post('/v1/friends/request')
            .set('x-test-user-id', user1Id)
            .send({ recipient: 'user2@example.com' });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.requesterId).toBe(user1Id);
        expect(res.body.data.recipientId).toBe(user2Id);
        expect(res.body.data.status).toBe('pending');
        requestId = res.body.data._id;
    });
    it('should not allow sending a friend request to oneself', async () => {
        const res = await request(app)
            .post('/v1/friends/request')
            .set('x-test-user-id', user1Id)
            .send({ recipient: 'user1@example.com' });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });
    it('should prevent sending duplicate pending request', async () => {
        const res = await request(app)
            .post('/v1/friends/request')
            .set('x-test-user-id', user1Id)
            .send({ recipient: 'user2@example.com' });
        expect(res.status).toBe(409);
        expect(res.body.success).toBe(false);
    });
    it('should show the pending friend request for User Two', async () => {
        const res = await request(app)
            .get('/v1/friends/pending')
            .set('x-test-user-id', user2Id);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].requestId).toBe(requestId);
        expect(res.body.data[0].requester.name).toBe('User One');
    });
    it('should allow User Two to accept the friend request', async () => {
        const res = await request(app)
            .post('/v1/friends/accept')
            .set('x-test-user-id', user2Id)
            .send({ requestId });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('accepted');
    });
    it('should list User Two as a friend of User One', async () => {
        const res = await request(app)
            .get('/v1/friends')
            .set('x-test-user-id', user1Id);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].friend.name).toBe('User Two');
    });
    it('should list User One as a friend of User Two', async () => {
        const res = await request(app)
            .get('/v1/friends')
            .set('x-test-user-id', user2Id);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].friend.name).toBe('User One');
    });
    it('should decline a new request from User Three to User Two', async () => {
        // User Three sends request to User Two
        const reqRes = await request(app)
            .post('/v1/friends/request')
            .set('x-test-user-id', user3Id)
            .send({ recipient: user2Id });
        expect(reqRes.status).toBe(201);
        const newReqId = reqRes.body.data._id;
        // User Two declines it
        const declineRes = await request(app)
            .post('/v1/friends/decline')
            .set('x-test-user-id', user2Id)
            .send({ requestId: newReqId });
        expect(declineRes.status).toBe(200);
        expect(declineRes.body.data.status).toBe('declined');
    });
});
