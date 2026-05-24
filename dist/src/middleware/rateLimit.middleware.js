import { redisClient } from '../config/redis.js';
import { error } from '../utils/response.js';
export async function rateLimitMiddleware(req, res, next) {
    // Skip rate limiting in test mode
    if (process.env.NODE_ENV === 'test') {
        return next();
    }
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `ratelimit:${ip}:${req.path}`;
    const limit = 100;
    const windowSeconds = 15 * 60; // 15 minutes
    try {
        const current = await redisClient.incr(key);
        if (current === 1) {
            await redisClient.expire(key, windowSeconds);
        }
        if (current > limit) {
            return error(res, 'RATE_LIMITED', 'Too many requests. Please try again in 15 minutes.', 429);
        }
        next();
    }
    catch (err) {
        // Fail-open: if Redis has connection issues, let the request proceed
        next();
    }
}
