import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { HealthSync } from '../../src/modules/health/health.model.js';
import { disconnectDb } from '../../src/config/db.js';
import { redisClient } from '../../src/config/redis.js';
describe('Health Integration Integration Tests', () => {
    const userId = '60d5ec49f8d5f32a7c8e9b13';
    beforeAll(async () => {
        await HealthSync.deleteMany({ userId });
    });
    afterAll(async () => {
        await HealthSync.deleteMany({ userId });
        await redisClient.quit();
        await disconnectDb();
    });
    it('should successfully connect Apple Health', async () => {
        const res = await request(app)
            .post('/v1/health/apple/connect')
            .set('x-test-user-id', userId)
            .send({ appleId: 'apple-test-id' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('Apple Health connected successfully');
    });
    it('should successfully connect Google Health Connect', async () => {
        const res = await request(app)
            .post('/v1/health/android/connect')
            .set('x-test-user-id', userId)
            .send({ googleId: 'google-test-id' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('Google Health Connect connected successfully');
    });
    it('should successfully sync health metrics', async () => {
        const res = await request(app)
            .post('/v1/health/sync')
            .set('x-test-user-id', userId)
            .send({
            provider: 'apple',
            dataPoints: [
                {
                    type: 'STEPS',
                    value: 2000,
                    timestamp: new Date().toISOString()
                },
                {
                    type: 'CALORIES',
                    value: 120,
                    timestamp: new Date().toISOString()
                }
            ]
        });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        const doc = await HealthSync.findOne({ userId });
        expect(doc).not.toBeNull();
        expect(doc.provider).toBe('apple');
        expect(doc.dataPoints.length).toBe(2);
        expect(doc.dataPoints[0].type).toBe('STEPS');
        expect(doc.dataPoints[0].value).toBe(2000);
    });
});
