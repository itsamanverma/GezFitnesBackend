import { Router } from 'express';
import { auth } from './auth.js';
import { generateAccessToken, verifyAccessToken } from './jwt.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

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
const sendResponse = (res: any, status: number, data?: any, error?: any) => {
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
    
    await db.collection('sessions').updateOne(
      { _id: sessionDoc._id },
      { $set: { 
        hashedMobileToken, 
        deviceId: deviceId || 'unknown',
        platform: platform || 'unknown',
        appVersion: appVersion || 'unknown',
        loginAt: new Date(),
        lastActiveAt: new Date()
      } }
    );

    const refreshToken = `${sessionDoc._id.toString()}.${mobileSecret}`;
    const accessToken = generateAccessToken(result.user.id, sessionDoc._id.toString());

    sendResponse(res, 201, {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: result.user
    });
  } catch (error: any) {
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
    
    await db.collection('sessions').updateOne(
      { _id: sessionDoc._id },
      { $set: { 
        hashedMobileToken, 
        deviceId: deviceId || 'unknown',
        platform: platform || 'unknown',
        appVersion: appVersion || 'unknown',
        loginAt: new Date(),
        lastActiveAt: new Date()
      } }
    );

    const refreshToken = `${sessionDoc._id.toString()}.${mobileSecret}`;
    const accessToken = generateAccessToken(result.user.id, sessionDoc._id.toString());

    sendResponse(res, 200, {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: result.user
    });
  } catch (error: any) {
    sendResponse(res, 401, null, { code: 'UNAUTHORIZED', message: error.message || 'Login failed' });
  }
});

// Helper to verify Google ID Token
async function verifyGoogleIdToken(token: string): Promise<{ email: string; providerId: string; name: string; profilePicture: string }> {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
  if (!res.ok) {
    throw new Error('Invalid Google ID Token signature or expired');
  }
  const payload = await res.json();
  
  if (env.GOOGLE_CLIENT_ID && payload.aud !== env.GOOGLE_CLIENT_ID) {
    throw new Error('Google ID Token audience mismatch');
  }

  return {
    email: payload.email,
    providerId: payload.sub,
    name: payload.name || `${payload.given_name || ''} ${payload.family_name || ''}`.trim(),
    profilePicture: payload.picture || '',
  };
}

// Helper to verify Apple ID Token
async function verifyAppleIdToken(token: string): Promise<{ email: string; providerId: string; name: string; profilePicture: string }> {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === 'string') {
    throw new Error('Invalid Apple ID Token format');
  }
  
  const kid = decoded.header.kid;
  if (!kid) {
    throw new Error('Apple ID Token missing kid');
  }

  const res = await fetch('https://appleid.apple.com/auth/keys');
  if (!res.ok) {
    throw new Error('Failed to fetch Apple public keys');
  }
  
  const { keys } = await res.json();
  const jwk = keys.find((key: any) => key.kid === kid);
  if (!jwk) {
    throw new Error('Matching Apple public key not found');
  }

  const publicKeyObj = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const pem = publicKeyObj.export({ type: 'spki', format: 'pem' });

  const payload = jwt.verify(token, pem, {
    algorithms: ['RS256'],
    issuer: 'https://appleid.apple.com',
    audience: env.APPLE_CLIENT_ID || undefined,
  }) as any;

  return {
    email: payload.email,
    providerId: payload.sub,
    name: payload.name || '',
    profilePicture: '',
  };
}

v1AuthRouter.post('/social', loginLimiter, async (req, res, next) => {
  try {
    const { provider, idToken, deviceId, platform, appVersion, fcmToken } = req.body;
    
    if (!provider || !idToken) {
      return sendResponse(res, 400, null, { code: 'BAD_REQUEST', message: 'Provider and idToken are required.' });
    }

    const tokenStr = typeof idToken === 'string' ? idToken : idToken.token;
    if (!tokenStr) {
      return sendResponse(res, 400, null, { code: 'BAD_REQUEST', message: 'idToken value is required.' });
    }

    // 1. Verify idToken
    let userDetails: { email: string; providerId: string; name: string; profilePicture: string };
    if (provider === 'google') {
      try {
        userDetails = await verifyGoogleIdToken(tokenStr);
      } catch (err: any) {
        return sendResponse(res, 401, null, { code: 'INVALID_TOKEN', message: err.message || 'Google token verification failed.' });
      }
    } else if (provider === 'apple') {
      try {
        userDetails = await verifyAppleIdToken(tokenStr);
      } catch (err: any) {
        return sendResponse(res, 401, null, { code: 'INVALID_TOKEN', message: err.message || 'Apple token verification failed.' });
      }
    } else {
      return sendResponse(res, 400, null, { code: 'BAD_REQUEST', message: 'Unsupported social provider.' });
    }

    const { email, providerId, name, profilePicture } = userDetails;
    if (!email) {
      return sendResponse(res, 400, null, { code: 'BAD_REQUEST', message: 'Email not found in social token.' });
    }

    const { db } = await import('../config/db.js');
    
    // 2. Email Exist in Database?
    const existingUser = await db.collection('users').findOne({ email: email.toLowerCase() });
    let userId = '';

    if (existingUser) {
      // Verify: provider == 'google/apple' OR throw custom error (Invalid Provider)
      const account = await db.collection('accounts').findOne({ userId: existingUser._id });
      if (!account || account.providerId !== provider) {
        return sendResponse(res, 400, null, { code: 'INVALID_PROVIDER', message: 'Email already registered with another sign-in method.' });
      }
      userId = existingUser._id;
      
      if (profilePicture && !existingUser.image) {
        await db.collection('users').updateOne({ _id: userId }, { $set: { image: profilePicture } });
      }
    } else {
      // Register: Create entry in user collection with user details
      userId = crypto.randomUUID();
      const newUser = {
        _id: userId,
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        emailVerified: true,
        image: profilePicture || '',
        role: 'user',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await db.collection('users').insertOne(newUser);

      // Create linked account
      const newAccount = {
        _id: crypto.randomUUID(),
        userId: userId,
        accountId: providerId,
        providerId: provider,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await db.collection('accounts').insertOne(newAccount);
    }

    // 3. Save/Update FCM Token if mobile
    const isMobile = platform === 'ios' || platform === 'android' || !!fcmToken;
    if (isMobile && fcmToken) {
      await db.collection('users').updateOne({ _id: userId }, { $set: { fcmToken } });
    }

    // 4. Generate JWT Token (AccessToken & RefreshToken)
    const { ObjectId } = await import('mongodb');
    const sessionId = new ObjectId();
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    
    const mobileSecret = crypto.randomBytes(32).toString('hex');
    const hashedMobileToken = await bcrypt.hash(mobileSecret, 10);
    
    const sessionDoc: any = {
      _id: sessionId,
      token: sessionToken,
      userId: userId,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
      hashedMobileToken,
      deviceId: deviceId || 'unknown',
      platform: platform || 'unknown',
      appVersion: appVersion || 'unknown',
      loginAt: new Date(),
      lastActiveAt: new Date()
    };

    if (isMobile && fcmToken) {
      sessionDoc.fcmToken = fcmToken;
    }

    await db.collection('sessions').insertOne(sessionDoc);

    const refreshToken = `${sessionId.toString()}.${mobileSecret}`;
    const accessToken = generateAccessToken(userId, sessionId.toString());

    const finalUser = await db.collection('users').findOne({ _id: userId });

    sendResponse(res, 200, {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: finalUser
    });
  } catch (error: any) {
    sendResponse(res, 500, null, { code: 'INTERNAL_ERROR', message: error.message || 'Social login failed' });
  }
});

v1AuthRouter.get('/social/callback', async (req, res) => {
  try {
    const sessionInfo = await auth.api.getSession({ headers: req.headers });
    
    const frontendDashboardUrl = env.ALLOWED_ORIGINS[0] || 'http://localhost:5173';

    if (!sessionInfo || !sessionInfo.session || !sessionInfo.user) {
      return res.redirect(`${frontendDashboardUrl}/login?error=Unauthorized`);
    }

    const { db } = await import('../config/db.js');
    const user = sessionInfo.user;
    const userId = user.id;

    // Generate tokens
    const { ObjectId } = await import('mongodb');
    const sessionId = new ObjectId();
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    
    const mobileSecret = crypto.randomBytes(32).toString('hex');
    const hashedMobileToken = await bcrypt.hash(mobileSecret, 10);
    
    const userAgent = req.headers['user-agent'] || '';
    const platformQuery = req.query.platform as string;
    const isMobile = platformQuery === 'ios' || platformQuery === 'android' || 
                     req.query.isMobile === 'true' || req.query.mobile === 'true' ||
                     /mobile|iphone|ipad|android/i.test(userAgent);
    
    const platform = platformQuery || (isMobile ? 'mobile' : 'web');
    const deviceId = (req.query.deviceId as string) || 'unknown';
    const appVersion = (req.query.appVersion as string) || 'unknown';
    const fcmToken = req.query.fcmToken as string;

    const sessionDoc: any = {
      _id: sessionId,
      token: sessionToken,
      userId: userId,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
      hashedMobileToken,
      deviceId,
      platform,
      appVersion,
      loginAt: new Date(),
      lastActiveAt: new Date()
    };

    if (isMobile && fcmToken) {
      sessionDoc.fcmToken = fcmToken;
      await db.collection('users').updateOne({ _id: userId }, { $set: { fcmToken } });
    }

    await db.collection('sessions').insertOne(sessionDoc);

    const refreshToken = `${sessionId.toString()}.${mobileSecret}`;
    const accessToken = generateAccessToken(userId, sessionId.toString());

    if (isMobile) {
      const deepLinkBase = (req.query.callbackURL as string) || 'gezfit://auth/callback';
      const deepLinkUrl = `${deepLinkBase}?accessToken=${accessToken}&refreshToken=${refreshToken}`;
      return res.redirect(deepLinkUrl);
    } else {
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      return res.redirect(frontendDashboardUrl);
    }
  } catch (error: any) {
    console.error('Social callback error:', error);
    const frontendDashboardUrl = env.ALLOWED_ORIGINS[0] || 'http://localhost:5173';
    return res.redirect(`${frontendDashboardUrl}/login?error=InternalError`);
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
    
    await db.collection('sessions').updateOne(
      { _id: session._id },
      { $set: { hashedMobileToken: newHashedMobileToken, lastActiveAt: new Date(), updatedAt: new Date() } }
    );

    const newRefreshToken = `${session._id.toString()}.${newMobileSecret}`;
    const newAccessToken = generateAccessToken(session.userId.toString(), session._id.toString());

    sendResponse(res, 200, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900
    });
  } catch (error: any) {
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
  } catch (error: any) {
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
  } catch (error: any) {
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
  } catch (error: any) {
    sendResponse(res, 500, null, { code: 'INTERNAL_ERROR', message: 'Failed to fetch user' });
  }
});

// Phase 6: Email Auth Foundation
v1AuthRouter.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return sendResponse(res, 400, null, { code: 'MISSING_TOKEN', message: 'Verification token is required' });
    
    await auth.api.verifyEmail({ query: { token }, asResponse: false });
    
    sendResponse(res, 200, { message: 'Email verified successfully' });
  } catch (error: any) {
    sendResponse(res, 400, null, { code: 'VERIFICATION_FAILED', message: error.message || 'Email verification failed' });
  }
});

v1AuthRouter.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return sendResponse(res, 400, null, { code: 'MISSING_EMAIL', message: 'Email is required' });
    
    await auth.api.sendVerificationEmail({ body: { email }, asResponse: false });
    
    sendResponse(res, 200, { message: 'Verification email sent' });
  } catch (error: any) {
    sendResponse(res, 400, null, { code: 'RESEND_FAILED', message: error.message || 'Failed to send verification email' });
  }
});

v1AuthRouter.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return sendResponse(res, 400, null, { code: 'MISSING_EMAIL', message: 'Email is required' });
    
    await auth.api.requestPasswordReset({ body: { email }, asResponse: false });
    
    sendResponse(res, 200, { message: 'Password reset link sent' });
  } catch (error: any) {
    sendResponse(res, 400, null, { code: 'FORGOT_PASSWORD_FAILED', message: error.message || 'Failed to process forgot password' });
  }
});

v1AuthRouter.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return sendResponse(res, 400, null, { code: 'MISSING_DATA', message: 'Token and new password are required' });
    
    await auth.api.resetPassword({ body: { newPassword, token }, asResponse: false });
    
    sendResponse(res, 200, { message: 'Password reset successfully' });
  } catch (error: any) {
    sendResponse(res, 400, null, { code: 'RESET_FAILED', message: error.message || 'Password reset failed' });
  }
});

authRouter.use('/v1', v1AuthRouter);
