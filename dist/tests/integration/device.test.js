import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { Device } from '../../src/modules/devices/device.model.js';
import { disconnectDb } from '../../src/config/db.js';
import { redisClient } from '../../src/config/redis.js';
describe('Device Registration Integration Tests', () => {
    const userId = '60d5ec49f8d5f32a7c8e9b12';
    beforeAll(async () => {
        await Device.deleteMany({ userId });
    });
    afterAll(async () => {
        await Device.deleteMany({ userId });
        await redisClient.quit();
        await disconnectDb();
    });
    it('should successfully register a device', async () => {
        const res = await request(app)
            .post('/v1/devices/register')
            .set('x-test-user-id', userId)
            .send({
            deviceToken: 'apns-fcm-token-token',
            platform: 'ios',
            deviceId: 'iphone15pro',
            appVersion: '1.0.0'
        });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('Device registered successfully');
        // Check DB
        const deviceDoc = await Device.findOne({ userId, deviceId: 'iphone15pro' });
        expect(deviceDoc).not.toBeNull();
        expect(deviceDoc.deviceToken).toBe('apns-fcm-token-token');
        expect(deviceDoc.platform).toBe('ios');
    });
    it('should reject registration when missing fields', async () => {
        const res = await request(app)
            .post('/v1/devices/register')
            .set('x-test-user-id', userId)
            .send({
            deviceToken: 'apns-fcm-token-token',
            platform: 'ios'
        });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });
});
