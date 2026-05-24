import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { User } from '../../src/modules/user/user.model.js';
import { disconnectDb } from '../../src/config/db.js';
import { redisClient } from '../../src/config/redis.js';

describe('User Profile Integration Tests', () => {
  const userId = 'user-profile-test-123';

  beforeAll(async () => {
    await User.deleteMany({ _id: userId });
    await User.create({
      _id: userId,
      name: 'Test Profile User',
      email: 'profile-test@example.com',
      emailVerified: true,
    });
  });

  afterAll(async () => {
    await User.deleteMany({ _id: userId });
    await redisClient.quit();
    await disconnectDb();
  });

  it('should retrieve own profile details', async () => {
    const res = await request(app)
      .get('/v1/users/me')
      .set('x-test-user-id', userId)
      .set('x-test-user-email', 'profile-test@example.com');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Test Profile User');
    expect(res.body.data.email).toBe('profile-test@example.com');
  });

  it('should update profile details', async () => {
    const res = await request(app)
      .patch('/v1/users/me')
      .set('x-test-user-id', userId)
      .send({ name: 'New Profile Name' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('New Profile Name');
  });

  it('should reject update with extra fields (strict zod)', async () => {
    const res = await request(app)
      .patch('/v1/users/me')
      .set('x-test-user-id', userId)
      .send({ name: 'New Name', extraField: 'not-allowed' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should delete user profile (GDPR)', async () => {
    const res = await request(app)
      .delete('/v1/users/me')
      .set('x-test-user-id', userId);

    expect(res.status).toBe(204);

    const user = await User.findById(userId);
    expect(user).toBeNull();
  });
});
