import { Router } from 'express';
import { requireAuth } from '../../auth/auth.middleware.js';
import { Device } from './device.model.js';
import { success, error as errorResponse } from '../../utils/response.js';
import { Types } from 'mongoose';
const router = Router();
router.post('/register', requireAuth, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { deviceToken, platform, deviceId, appVersion } = req.body;
        if (!deviceToken || !platform || !deviceId || !appVersion) {
            return errorResponse(res, 'BAD_REQUEST', 'deviceToken, platform, deviceId, and appVersion are required', 400);
        }
        if (!['ios', 'android', 'web'].includes(platform)) {
            return errorResponse(res, 'BAD_REQUEST', 'platform must be ios, android, or web', 400);
        }
        await Device.findOneAndUpdate({ userId: new Types.ObjectId(userId), deviceId }, {
            deviceToken,
            platform,
            appVersion,
            lastRegisteredAt: new Date()
        }, { upsert: true, new: true });
        return success(res, null, 'Device registered successfully', 200);
    }
    catch (err) {
        next(err);
    }
});
export default router;
