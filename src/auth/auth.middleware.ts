import { Request, Response, NextFunction } from 'express';
import { auth } from './auth.js';
import { redisClient } from '../config/redis.js';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import mongoose from 'mongoose';
import crypto from 'crypto';

// Extend Express request type declaration
declare global {
  namespace Express {
    interface Request {
      user?: any;
      session?: any;
    }
  }
}

export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return next(new UnauthorizedError('API key is missing'));
  }
  
  if (apiKey !== process.env.BETTER_AUTH_API_KEY) {
    return next(new ForbiddenError('Invalid API key'));
  }
  
  next();
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Support testing by bypassing authenticating when test headers are present
  if (process.env.NODE_ENV === 'test' && req.headers['x-test-user-id']) {
    req.user = {
      id: req.headers['x-test-user-id'] as string,
      email: (req.headers['x-test-user-email'] || 'test@example.com') as string,
      name: (req.headers['x-test-user-name'] || 'Test User') as string,
    };
    req.session = {
      id: 'test-session-id',
      expiresAt: new Date(Date.now() + 3600 * 1000),
    };
    return next();
  }

  try {
    const authHeader = req.headers.authorization;
    let token = '';
    let isJwt = false;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
      isJwt = true;
    } else {
      const cookies = req.headers.cookie || '';
      const tokenMatch = cookies.match(/better-auth\.session_token=([^;]+)/);
      if (tokenMatch) {
        token = tokenMatch[1];
      }
    }

    if (!token) {
      throw new UnauthorizedError('Authentication token missing');
    }

    if (isJwt) {
      const { verifyAccessToken } = await import('./jwt.js');
      const decoded = verifyAccessToken(token);
      if (!decoded) {
        throw new UnauthorizedError('Invalid or expired access token');
      }

      const sessionCacheKey = `cache:session:${crypto.createHash('sha256').update(decoded.sid).digest('hex')}`;
      
      try {
        const cached = await redisClient.get(sessionCacheKey);
        if (cached) {
          const { session, user } = JSON.parse(cached);
          req.session = session;
          req.user = user;
          return next();
        }
      } catch (cacheErr) {}

      // If not in cache, verify the session actually still exists in DB
      const { db } = await import('../config/db.js');
      const { ObjectId } = await import('mongodb');
      const session = await db.collection('sessions').findOne({ _id: new ObjectId(decoded.sid) });
      
      if (!session || session.expiresAt < new Date()) {
        throw new UnauthorizedError('Session revoked or expired');
      }

      const user = await db.collection('users').findOne({ _id: session.userId });
      
      req.session = { id: session.token, ...session };
      req.user = { id: user._id.toString(), ...user };

      try {
        await redisClient.setex(sessionCacheKey, 300, JSON.stringify({ session: req.session, user: req.user }));
      } catch (cacheErr) {}

      return next();
    }

    // Fallback for cookie-based session checking (for potential web usage)
    const sessionCacheKey = `cache:session:${crypto.createHash('sha256').update(token).digest('hex')}`;

    try {
      const cached = await redisClient.get(sessionCacheKey);
      if (cached) {
        const { session, user } = JSON.parse(cached);
        req.session = session;
        req.user = user;
        return next();
      }
    } catch (cacheErr) {}

    const sessionInfo = await auth.api.getSession({ headers: req.headers });
    if (!sessionInfo || !sessionInfo.session || !sessionInfo.user) {
      throw new UnauthorizedError('Invalid or expired session');
    }

    req.session = sessionInfo.session;
    req.user = sessionInfo.user;

    // Cache the session for 5 minutes
    try {
      await redisClient.setex(sessionCacheKey, 300, JSON.stringify(sessionInfo));
    } catch (cacheErr) {
      // Ignore cache write errors
    }

    next();
  } catch (err) {
    next(err);
  }
}

export function requireWorkspaceRole(allowedRoles: ('owner' | 'admin' | 'member' | 'viewer')[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const workspaceIdStr = req.params.id || req.params.workspaceId;
      if (!workspaceIdStr) {
        throw new NotFoundError('Workspace ID not provided in request parameters');
      }

      if (!mongoose.Types.ObjectId.isValid(workspaceIdStr)) {
        throw new NotFoundError('Invalid workspace ID format');
      }

      const workspaceId = new mongoose.Types.ObjectId(workspaceIdStr);
      const userId = req.user.id;

      // Dynamically get the WorkspaceMember model to avoid circular dependency at boot
      const WorkspaceMember = mongoose.model('WorkspaceMember');
      
      const member = await WorkspaceMember.findOne({
        workspaceId,
        userId,
      });

      if (!member) {
        throw new ForbiddenError('You are not a member of this workspace');
      }

      if (!allowedRoles.includes(member.role)) {
        throw new ForbiddenError('Insufficient permissions in this workspace');
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
