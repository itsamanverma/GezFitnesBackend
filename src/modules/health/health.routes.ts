import { Router } from 'express';
import { requireAuth } from '../../auth/auth.middleware.js';
import { HealthSync } from './health.model.js';
import { success, error as errorResponse } from '../../utils/response.js';
import { Types } from 'mongoose';
import { redisClient } from '../../config/redis.js';

const router = Router();

// Connect Apple Health
router.post('/apple/connect', requireAuth, async (req, res, next) => {
  try {
    const { appleId } = req.body;
    if (!appleId) {
      return errorResponse(res, 'BAD_REQUEST', 'appleId is required', 400);
    }
    
    // In a real application, you would link this in the User document or verify the connection.
    // For now we will return success.
    return success(res, null, 'Apple Health connected successfully', 200);
  } catch (err) {
    next(err);
  }
});

// Connect Google Health Connect (Android)
router.post('/android/connect', requireAuth, async (req, res, next) => {
  try {
    const { googleId } = req.body;
    if (!googleId) {
      return errorResponse(res, 'BAD_REQUEST', 'googleId is required', 400);
    }
    
    return success(res, null, 'Google Health Connect connected successfully', 200);
  } catch (err) {
    next(err);
  }
});

// Sync Health Data
router.post('/sync', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { provider, dataPoints } = req.body;

    if (!provider || !dataPoints || !Array.isArray(dataPoints)) {
      return errorResponse(res, 'BAD_REQUEST', 'provider and dataPoints array are required', 400);
    }

    if (!['apple', 'android'].includes(provider)) {
      return errorResponse(res, 'BAD_REQUEST', 'provider must be apple or android', 400);
    }

    // Validate data points structure
    for (const point of dataPoints) {
      if (!point.type || point.value === undefined || !point.timestamp) {
        return errorResponse(res, 'BAD_REQUEST', 'Each dataPoint must have type, value, and timestamp', 400);
      }
    }

    // Save synced data points
    await HealthSync.create({
      userId: new Types.ObjectId(userId),
      provider,
      dataPoints: dataPoints.map(p => ({
        type: p.type,
        value: Number(p.value),
        timestamp: new Date(p.timestamp)
      }))
    });

    // Invalidate dashboard cache
    await redisClient.del(`cache:dashboard:${userId}`);

    return success(res, null, 'Health data synchronized successfully', 200);
  } catch (err) {
    next(err);
  }
});

export default router;
