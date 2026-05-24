import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mongoose from 'mongoose';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth/auth.js';
import { env } from './config/env.js';
import { redisClient } from './config/redis.js';
import { requestIdMiddleware } from './middleware/requestId.middleware.js';
import { loggerMiddleware } from './middleware/logger.middleware.js';
import { rateLimitMiddleware } from './middleware/rateLimit.middleware.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerDocument } from './config/swagger.js';
import { userRoutes } from './modules/user/user.routes.js';
import { workspaceRoutes } from './modules/workspace/workspace.routes.js';
import { authRouter } from './auth/auth.routes.js';
const app = express();
// Trust reverse proxy (e.g. Pinggy, Cloud Run, Nginx) so req.ip is correct for rate limiting
app.set('trust proxy', 1);
// 1. Pre-BodyParser Middleware
app.use(requestIdMiddleware);
app.use(loggerMiddleware);
app.use(helmet());
app.use(cors({
    origin: env.ALLOWED_ORIGINS,
    credentials: true,
}));
app.use(rateLimitMiddleware);
// 2. Mount Better Auth Internal Handlers (MUST run before body parsing)
app.use((req, res, next) => {
    if (req.url.startsWith('/api/auth') && !req.url.startsWith('/api/auth/v1')) {
        return toNodeHandler(auth)(req, res);
    }
    next();
});
// 3. Post-Auth Body Parsing Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// 4. Mount Custom Token-Based Mobile Auth
app.use('/api/auth', authRouter);
// 5. Health Check Routes
app.get('/health', (req, res) => {
    return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
    });
});
app.get('/health/ready', async (req, res) => {
    const results = await Promise.allSettled([
        mongoose.connection.db ? mongoose.connection.db.admin().ping() : Promise.reject(new Error('DB not connected')),
        redisClient.ping(),
    ]);
    const dbOk = results[0].status === 'fulfilled';
    const redisOk = results[1].status === 'fulfilled';
    const dbStatus = dbOk ? 'ok' : 'error';
    const redisStatus = redisOk ? 'ok' : 'error';
    if (dbOk && redisOk) {
        return res.status(200).json({
            status: 'ready',
            db: dbStatus,
            redis: redisStatus,
        });
    }
    const overallStatus = !dbOk && !redisOk ? 'down' : 'degraded';
    return res.status(503).json({
        status: overallStatus,
        db: dbStatus,
        redis: redisStatus,
    });
});
// 5. Swagger API Docs
app.use('/docs', (req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;");
    next();
}, swaggerUi.serve, swaggerUi.setup(swaggerDocument));
import activityRoutes from './modules/activities/activity.routes.js';
import replayRoutes from './modules/replay/replay.routes.js';
import liveSessionRoutes from './modules/liveSessions/liveSession.routes.js';
// 6. App Routes
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/workspaces', workspaceRoutes);
app.use('/api/v1/activities', activityRoutes);
app.use('/api/v1/replay', replayRoutes);
app.use('/api/v1/live-sessions', liveSessionRoutes);
// 6. 404 Route
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Cannot ${req.method} ${req.path}`,
        },
    });
});
// 7. Global Error Handler
app.use(errorMiddleware);
export { app };
export default app;
