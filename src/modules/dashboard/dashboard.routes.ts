import { Router } from 'express';
import { Types } from 'mongoose';
import { requireAuth } from '../../auth/auth.middleware.js';
import { Activity } from '../activities/activity.model.js';
import { Group } from '../groups/group.model.js';
import { GroupMember } from '../groups/groupMember.model.js';
import { LiveSession } from '../liveSessions/liveSession.model.js';
import { success } from '../../utils/response.js';
import { SESSION_STATUS } from '../../utils/constants.js';
import { redisClient } from '../../config/redis.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const cacheKey = `cache:dashboard:${userId}`;

    // Try fetching from cache
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        return success(res, parsed);
      } catch (err) {
        // Fallback to database query if parsing fails
      }
    }

    // 1. Aggregated workout statistics
    const statsResult = await Activity.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalDistanceMeters: { $sum: '$distanceMeters' },
          totalDurationSeconds: { $sum: '$durationSeconds' },
          activityCount: { $sum: 1 },
        },
      },
    ]);

    const stats = statsResult[0] || {
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
      activityCount: 0,
    };
    
    if ((stats as any)._id !== undefined) {
      delete (stats as any)._id;
    }

    // 2. Fetch the 5 most recent activities (excluding heavy polyline data)
    const recentActivities = await Activity.find({ userId })
      .sort({ startedAt: -1 })
      .limit(5)
      .select('-routePolyline');

    // 3. Fetch active groups user is a member of
    const memberships = await GroupMember.find({
      userId: new Types.ObjectId(userId),
      status: 'active',
    });
    const groupIds = memberships.map(m => m.groupId);
    const activeGroups = await Group.find({
      _id: { $in: groupIds },
      isActive: true,
    });

    // 4. Retrieve current active live session if one exists
    const activeLiveSession = await LiveSession.findOne({
      userId: new Types.ObjectId(userId),
      status: SESSION_STATUS.ACTIVE,
    });

    const responseData = {
      stats,
      recentActivities,
      activeGroups,
      activeLiveSession,
    };

    // Cache the dashboard data in Redis for 5 minutes (300 seconds)
    await redisClient.set(cacheKey, JSON.stringify(responseData), 'EX', 300);

    return success(res, responseData);
  } catch (err) {
    next(err);
  }
});

export default router;
