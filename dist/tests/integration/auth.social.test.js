import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app.js';
import { User } from '../../src/modules/user/user.model.js';
import { disconnectDb } from '../../src/config/db.js';
import { redisClient } from '../../src/config/redis.js';
import { env } from '../../src/config/env.js';
import mongoose from 'mongoose';
describe('Social Login Integration Tests', () => {
    let appleKeyPair;
    let validAppleToken;
    beforeAll(async () => {
        // Cleanup previous tests users
        await User.deleteMany({ email: { $in: ['google-test@example.com', 'apple-test@example.com'] } });
        if (mongoose.connection.db) {
            await mongoose.connection.db.collection('accounts').deleteMany({
                email: { $in: ['google-test@example.com', 'apple-test@example.com'] }
            });
            await mongoose.connection.db.collection('sessions').deleteMany({
                deviceId: 'social-test-device'
            });
        }
        // Generate dynamic keypair for Apple Token verification
        appleKeyPair = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
        });
        const jwk = appleKeyPair.publicKey.export({ format: 'jwk' });
        jwk.kid = 'apple-kid-123';
        jwk.alg = 'RS256';
        // Mock global fetch for token verification calls
        vi.stubGlobal('fetch', async (url) => {
            if (url.includes('oauth2.googleapis.com/tokeninfo')) {
                if (url.includes('valid_google_token') && !url.includes('invalid_google_token')) {
                    return {
                        ok: true,
                        json: async () => ({
                            email: 'google-test@example.com',
                            sub: 'google-sub-123',
                            name: 'Google Test User',
                            picture: 'https://google.com/pic.png',
                            aud: env.GOOGLE_CLIENT_ID || 'google-client-id-xyz',
                        }),
                    };
                }
                return { ok: false };
            }
            if (url.includes('appleid.apple.com/auth/keys')) {
                return {
                    ok: true,
                    json: async () => ({
                        keys: [jwk],
                    }),
                };
            }
            return { ok: false };
        });
        // Create a valid Apple identity token
        validAppleToken = jwt.sign({
            email: 'apple-test@example.com',
            sub: 'apple-sub-456',
            iss: 'https://appleid.apple.com',
            aud: env.APPLE_CLIENT_ID || 'apple-client-id-abc',
        }, appleKeyPair.privateKey, {
            algorithm: 'RS256',
            header: {
                kid: 'apple-kid-123',
            },
        });
    });
    afterAll(async () => {
        await User.deleteMany({ email: { $in: ['google-test@example.com', 'apple-test@example.com'] } });
        if (mongoose.connection.db) {
            await mongoose.connection.db.collection('accounts').deleteMany({
                userId: { $in: ['google-sub-123', 'apple-sub-456'] }
            });
        }
        vi.unstubAllGlobals();
        await redisClient.quit();
        await disconnectDb();
    });
    it('should successfully register and login a new Google user', async () => {
        const res = await request(app)
            .post('/api/auth/v1/social')
            .send({
            provider: 'google',
            idToken: 'valid_google_token',
            deviceId: 'social-test-device',
            platform: 'ios',
            fcmToken: 'fcm-token-123',
        });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.accessToken).toBeDefined();
        expect(res.body.data.refreshToken).toBeDefined();
        expect(res.body.data.user.email).toBe('google-test@example.com');
        expect(res.body.data.user.image).toBe('https://google.com/pic.png');
        // Check user exists in Database
        const dbUser = await User.findOne({ email: 'google-test@example.com' });
        expect(dbUser).not.toBeNull();
        // Check account registration
        if (mongoose.connection.db) {
            const account = await mongoose.connection.db.collection('accounts').findOne({ userId: dbUser._id });
            expect(account).not.toBeNull();
            expect(account.providerId).toBe('google');
        }
    });
    it('should reject login if the Google token is invalid', async () => {
        const res = await request(app)
            .post('/api/auth/v1/social')
            .send({
            provider: 'google',
            idToken: 'invalid_google_token',
            deviceId: 'social-test-device',
            platform: 'ios',
        });
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('INVALID_TOKEN');
    });
    it('should successfully register and login a new Apple user', async () => {
        const res = await request(app)
            .post('/api/auth/v1/social')
            .send({
            provider: 'apple',
            idToken: validAppleToken,
            deviceId: 'social-test-device',
            platform: 'android',
            fcmToken: 'fcm-token-456',
        });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.accessToken).toBeDefined();
        expect(res.body.data.refreshToken).toBeDefined();
        expect(res.body.data.user.email).toBe('apple-test@example.com');
    });
    it('should prevent login with conflicting provider for an existing email', async () => {
        // Attempting Apple login with the email already registered via Google (google-test@example.com)
        const conflictingAppleToken = jwt.sign({
            email: 'google-test@example.com', // Registered via Google
            sub: 'apple-sub-789',
            iss: 'https://appleid.apple.com',
            aud: 'apple-client-id-abc',
        }, appleKeyPair.privateKey, {
            algorithm: 'RS256',
            header: {
                kid: 'apple-kid-123',
            },
        });
        const res = await request(app)
            .post('/api/auth/v1/social')
            .send({
            provider: 'apple',
            idToken: conflictingAppleToken,
            deviceId: 'social-test-device',
            platform: 'ios',
        });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('INVALID_PROVIDER');
    });
});
