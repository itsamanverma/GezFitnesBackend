import { Router } from 'express';
import { auth } from './auth.js';
import { generateAccessToken, verifyAccessToken } from './jwt.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
export const authRouter = Router();
const v1AuthRouter = Router();
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later.' } }
});
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts, please try again later.' } }
});
const signupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many signup attempts, please try again later.' } }
});
v1AuthRouter.use(authLimiter);
// Standard API response formatter
const sendResponse = (res, status, data, error) => {
    if (error) {
        return res.status(status).json({ success: false, error });
    }
    return res.status(status).json({ success: true, data });
};
v1AuthRouter.post('/signup', signupLimiter, async (req, res, next) => {
    try {
        let { name, email, password, deviceId, platform, appVersion } = req.body;
        if (email) {
            email = email.trim().toLowerCase();
        }
        // Explicit server-side API call to Better Auth
        const result = await auth.api.signUpEmail({
            body: { name, email, password },
            asResponse: false
        });
        if (!result || !result.token) {
            return sendResponse(res, 400, null, { code: 'SIGNUP_FAILED', message: 'Could not create user.' });
        }
        const { db } = await import('../config/db.js');
        const sessionDoc = await db.collection('sessions').findOne({ token: result.token });
        const mobileSecret = crypto.randomBytes(32).toString('hex');
        const hashedMobileToken = await bcrypt.hash(mobileSecret, 10);
        await db.collection('sessions').updateOne({ _id: sessionDoc._id }, { $set: {
                hashedMobileToken,
                deviceId: deviceId || 'unknown',
                platform: platform || 'unknown',
                appVersion: appVersion || 'unknown',
                loginAt: new Date(),
                lastActiveAt: new Date()
            } });
        const refreshToken = `${sessionDoc._id.toString()}.${mobileSecret}`;
        const accessToken = generateAccessToken(result.user.id, sessionDoc._id.toString());
        sendResponse(res, 201, {
            accessToken,
            refreshToken,
            expiresIn: 900,
            user: result.user
        });
    }
    catch (error) {
        sendResponse(res, 400, null, { code: 'BAD_REQUEST', message: error.message || 'Signup failed' });
    }
});
v1AuthRouter.post('/login', loginLimiter, async (req, res, next) => {
    try {
        let { email, password, deviceId, platform, appVersion } = req.body;
        if (email) {
            email = email.trim().toLowerCase();
        }
        const result = await auth.api.signInEmail({
            body: { email, password },
            asResponse: false
        });
        if (!result || !result.token) {
            return sendResponse(res, 401, null, { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
        }
        const { db } = await import('../config/db.js');
        const sessionDoc = await db.collection('sessions').findOne({ token: result.token });
        const mobileSecret = crypto.randomBytes(32).toString('hex');
        const hashedMobileToken = await bcrypt.hash(mobileSecret, 10);
        await db.collection('sessions').updateOne({ _id: sessionDoc._id }, { $set: {
                hashedMobileToken,
                deviceId: deviceId || 'unknown',
                platform: platform || 'unknown',
                appVersion: appVersion || 'unknown',
                loginAt: new Date(),
                lastActiveAt: new Date()
            } });
        const refreshToken = `${sessionDoc._id.toString()}.${mobileSecret}`;
        const accessToken = generateAccessToken(result.user.id, sessionDoc._id.toString());
        sendResponse(res, 200, {
            accessToken,
            refreshToken,
            expiresIn: 900,
            user: result.user
        });
    }
    catch (error) {
        sendResponse(res, 401, null, { code: 'UNAUTHORIZED', message: error.message || 'Login failed' });
    }
});
v1AuthRouter.post('/social', loginLimiter, async (req, res, next) => {
    try {
        const { provider, idToken, deviceId, platform, appVersion } = req.body;
        if (!provider || !idToken) {
            return sendResponse(res, 400, null, { code: 'BAD_REQUEST', message: 'Provider and idToken are required.' });
        }
        // Call Better Auth internally with the idToken payload
        const result = await auth.api.signInSocial({
            body: {
                provider,
                // Depending on Better Auth version, it might expect a string or an object. We'll pass the object format the client SDK sends.
                idToken: typeof idToken === 'string' ? { token: idToken } : idToken
            },
            asResponse: false
        });
        if (!result || !result.token) {
            return sendResponse(res, 401, null, { code: 'UNAUTHORIZED', message: 'Social authentication failed.' });
        }
        const { db } = await import('../config/db.js');
        const sessionDoc = await db.collection('sessions').findOne({ token: result.token });
        if (!sessionDoc)
            throw new Error('Failed to locate social session');
        const mobileSecret = crypto.randomBytes(32).toString('hex');
        const hashedMobileToken = await bcrypt.hash(mobileSecret, 10);
        await db.collection('sessions').updateOne({ _id: sessionDoc._id }, { $set: {
                hashedMobileToken,
                deviceId: deviceId || 'unknown',
                platform: platform || 'unknown',
                appVersion: appVersion || 'unknown',
                loginAt: new Date(),
                lastActiveAt: new Date()
            } });
        const refreshToken = `${sessionDoc._id.toString()}.${mobileSecret}`;
        const accessToken = generateAccessToken(result.user.id, sessionDoc._id.toString());
        sendResponse(res, 200, {
            accessToken,
            refreshToken,
            expiresIn: 900,
            user: result.user
        });
    }
    catch (error) {
        sendResponse(res, 401, null, { code: 'UNAUTHORIZED', message: error.message || 'Social login failed' });
    }
});
v1AuthRouter.post('/refresh', async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return sendResponse(res, 400, null, { code: 'MISSING_TOKEN', message: 'Refresh token is required.' });
        }
        const { db } = await import('../config/db.js');
        const { ObjectId } = await import('mongodb');
        const [sessionIdStr, mobileSecret] = refreshToken.split('.');
        if (!sessionIdStr || !mobileSecret) {
            return sendResponse(res, 401, null, { code: 'INVALID_TOKEN', message: 'Refresh token format invalid.' });
        }
        const session = await db.collection('sessions').findOne({ _id: new ObjectId(sessionIdStr) });
        if (!session || session.expiresAt < new Date()) {
            return sendResponse(res, 401, null, { code: 'INVALID_TOKEN', message: 'Session is invalid or expired.' });
        }
        if (!session.hashedMobileToken) {
            return sendResponse(res, 401, null, { code: 'INVALID_TOKEN', message: 'No mobile session found.' });
        }
        const isValid = await bcrypt.compare(mobileSecret, session.hashedMobileToken);
        if (!isValid) {
            return sendResponse(res, 401, null, { code: 'INVALID_TOKEN', message: 'Refresh token compromised or invalid.' });
        }
        // Refresh Token Rotation: Generate a new refresh token to replace the old one
        const newMobileSecret = crypto.randomBytes(32).toString('hex');
        const newHashedMobileToken = await bcrypt.hash(newMobileSecret, 10);
        await db.collection('sessions').updateOne({ _id: session._id }, { $set: { hashedMobileToken: newHashedMobileToken, lastActiveAt: new Date(), updatedAt: new Date() } });
        const newRefreshToken = `${session._id.toString()}.${newMobileSecret}`;
        const newAccessToken = generateAccessToken(session.userId.toString(), session._id.toString());
        sendResponse(res, 200, {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresIn: 900
        });
    }
    catch (error) {
        sendResponse(res, 401, null, { code: 'UNAUTHORIZED', message: 'Token refresh failed' });
    }
});
v1AuthRouter.post('/logout', async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return sendResponse(res, 401, null, { code: 'UNAUTHORIZED', message: 'Missing Bearer token' });
        }
        const accessToken = authHeader.split(' ')[1];
        const decoded = verifyAccessToken(accessToken);
        if (decoded && decoded.sid) {
            const { db } = await import('../config/db.js');
            const { ObjectId } = await import('mongodb');
            await db.collection('sessions').deleteOne({ _id: new ObjectId(decoded.sid) });
            const { redisClient } = await import('../config/redis.js');
            const crypto = await import('crypto');
            const sessionCacheKey = `cache:session:${crypto.createHash('sha256').update(decoded.sid).digest('hex')}`;
            await redisClient.del(sessionCacheKey);
        }
        sendResponse(res, 200, { message: 'Logged out successfully' });
    }
    catch (error) {
        console.error('Logout error:', error);
        sendResponse(res, 500, null, { code: 'INTERNAL_ERROR', message: 'Logout failed' });
    }
});
v1AuthRouter.post('/logout-all', async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return sendResponse(res, 401, null, { code: 'UNAUTHORIZED', message: 'Missing Bearer token' });
        }
        const accessToken = authHeader.split(' ')[1];
        const decoded = verifyAccessToken(accessToken);
        if (decoded && decoded.sub) {
            const { db } = await import('../config/db.js');
            const { redisClient } = await import('../config/redis.js');
            const { ObjectId } = await import('mongodb');
            // Get all sessions to invalidate their cache keys
            const sessions = await db.collection('sessions').find({ userId: new ObjectId(decoded.sub) }).toArray();
            const crypto = await import('crypto');
            for (const s of sessions) {
                const sessionCacheKey = `cache:session:${crypto.createHash('sha256').update(s._id.toString()).digest('hex')}`;
                await redisClient.del(sessionCacheKey);
            }
            await db.collection('sessions').deleteMany({ userId: new ObjectId(decoded.sub) });
        }
        sendResponse(res, 200, { message: 'All sessions logged out successfully' });
    }
    catch (error) {
        sendResponse(res, 500, null, { code: 'INTERNAL_ERROR', message: 'Global logout failed' });
    }
});
v1AuthRouter.get('/me', async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return sendResponse(res, 401, null, { code: 'UNAUTHORIZED', message: 'Missing Bearer token' });
        }
        const accessToken = authHeader.split(' ')[1];
        const decoded = verifyAccessToken(accessToken);
        if (!decoded) {
            return sendResponse(res, 401, null, { code: 'TOKEN_EXPIRED', message: 'Access token expired' });
        }
        const { db } = await import('../config/db.js');
        const { ObjectId } = await import('mongodb');
        const session = await db.collection('sessions').findOne({ _id: new ObjectId(decoded.sid) });
        if (!session || session.expiresAt < new Date()) {
            return sendResponse(res, 401, null, { code: 'SESSION_REVOKED', message: 'Session has been revoked or expired' });
        }
        const user = await db.collection('users').findOne({ _id: session.userId });
        sendResponse(res, 200, {
            user
        });
    }
    catch (error) {
        sendResponse(res, 500, null, { code: 'INTERNAL_ERROR', message: 'Failed to fetch user' });
    }
});
// Phase 6: Email Auth Foundation
v1AuthRouter.post('/verify-email', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token)
            return sendResponse(res, 400, null, { code: 'MISSING_TOKEN', message: 'Verification token is required' });
        await auth.api.verifyEmail({ query: { token }, asResponse: false });
        sendResponse(res, 200, { message: 'Email verified successfully' });
    }
    catch (error) {
        sendResponse(res, 400, null, { code: 'VERIFICATION_FAILED', message: error.message || 'Email verification failed' });
    }
});
v1AuthRouter.post('/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email)
            return sendResponse(res, 400, null, { code: 'MISSING_EMAIL', message: 'Email is required' });
        await auth.api.sendVerificationEmail({ body: { email }, asResponse: false });
        sendResponse(res, 200, { message: 'Verification email sent' });
    }
    catch (error) {
        sendResponse(res, 400, null, { code: 'RESEND_FAILED', message: error.message || 'Failed to send verification email' });
    }
});
v1AuthRouter.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email)
            return sendResponse(res, 400, null, { code: 'MISSING_EMAIL', message: 'Email is required' });
        await auth.api.requestPasswordReset({ body: { email }, asResponse: false });
        sendResponse(res, 200, { message: 'Password reset link sent' });
    }
    catch (error) {
        sendResponse(res, 400, null, { code: 'FORGOT_PASSWORD_FAILED', message: error.message || 'Failed to process forgot password' });
    }
});
v1AuthRouter.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword)
            return sendResponse(res, 400, null, { code: 'MISSING_DATA', message: 'Token and new password are required' });
        await auth.api.resetPassword({ body: { newPassword, token }, asResponse: false });
        sendResponse(res, 200, { message: 'Password reset successfully' });
    }
    catch (error) {
        sendResponse(res, 400, null, { code: 'RESET_FAILED', message: error.message || 'Password reset failed' });
    }
});
authRouter.use('/v1', v1AuthRouter);
