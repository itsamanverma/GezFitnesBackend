import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as userService from '../../src/modules/user/user.service.js';
import { User } from '../../src/modules/user/user.model.js';
import { disconnectDb } from '../../src/config/db.js';
import { redisClient } from '../../src/config/redis.js';
describe('User Service Unit Tests', () => {
    let testUser;
    beforeAll(async () => {
        // Clean up potential leftover test data
        await User.deleteMany({ email: 'test-service-user@example.com' });
        testUser = new User({
            _id: 'test-service-user-id-999',
            name: 'Test Service User',
            email: 'test-service-user@example.com',
            emailVerified: true,
        });
        await testUser.save();
    });
    afterAll(async () => {
        await User.deleteMany({ email: 'test-service-user@example.com' });
        await redisClient.quit();
        await disconnectDb();
    });
    it('should retrieve a user by ID and store in cache', async () => {
        const user = await userService.getUserById(testUser._id.toString());
        expect(user).toBeDefined();
        expect(user.email).toBe('test-service-user@example.com');
        // Verify it is cached in Redis
        const cached = await redisClient.get(`cache:user:${testUser._id.toString()}`);
        expect(cached).toBeDefined();
        expect(JSON.parse(cached).email).toBe('test-service-user@example.com');
    });
    it('should update user profile and invalidate cache', async () => {
        const updated = await userService.updateUser(testUser._id.toString(), {
            name: 'Updated Name',
        });
        expect(updated).toBeDefined();
        expect(updated.name).toBe('Updated Name');
        // Verify cache is cleared
        const cached = await redisClient.get(`cache:user:${testUser._id.toString()}`);
        expect(cached).toBeNull();
    });
});
