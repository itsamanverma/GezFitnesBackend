import { Activity } from './activity.model.js';
import { success, error as errorResponse } from '../../utils/response.js';
import { redisClient } from '../../config/redis.js';
export const createActivity = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return errorResponse(res, 'UNAUTHORIZED', 'Not authenticated', 401);
        }
        const { clientActivityId, ...rest } = req.body;
        // Phase 5: Idempotency Check for Offline Sync
        // If the mobile app retries an upload because of a timeout, don't duplicate it.
        if (clientActivityId) {
            const existingActivity = await Activity.findOne({ userId, clientActivityId });
            if (existingActivity) {
                // Return 200 OK (not 201 Created) to indicate it was already processed
                return success(res, existingActivity, undefined, 200);
            }
        }
        const activityData = { ...rest, clientActivityId, userId };
        const activity = await Activity.create(activityData);
        // Invalidate dashboard cache
        await redisClient.del(`cache:dashboard:${userId}`);
        return success(res, activity, undefined, 201);
    }
    catch (error) {
        // Graceful fallback for unique constraint violation race condition
        if (error.code === 11000 && req.body.clientActivityId) {
            const existingActivity = await Activity.findOne({ userId: req.user?.id, clientActivityId: req.body.clientActivityId });
            if (existingActivity)
                return success(res, existingActivity, undefined, 200);
        }
        return errorResponse(res, 'SERVER_ERROR', error.message, 500);
    }
};
export const getActivities = async (req, res) => {
    try {
        const userId = req.user?.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const activities = await Activity.find({ userId })
            .sort({ startedAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('-routePolyline'); // Omit heavy coordinates/polyline for list view
        const total = await Activity.countDocuments({ userId });
        return success(res, {
            activities,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        return errorResponse(res, 'SERVER_ERROR', error.message, 500);
    }
};
export const getActivityById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const activity = await Activity.findOne({ _id: id, userId });
        if (!activity) {
            return errorResponse(res, 'NOT_FOUND', 'Activity not found', 404);
        }
        return success(res, activity);
    }
    catch (error) {
        return errorResponse(res, 'SERVER_ERROR', error.message, 500);
    }
};
export const deleteActivity = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const activity = await Activity.findOneAndDelete({ _id: id, userId });
        if (!activity) {
            return errorResponse(res, 'NOT_FOUND', 'Activity not found', 404);
        }
        if (userId) {
            await redisClient.del(`cache:dashboard:${userId}`);
        }
        return success(res, { deleted: true, id });
    }
    catch (error) {
        return errorResponse(res, 'SERVER_ERROR', error.message, 500);
    }
};
