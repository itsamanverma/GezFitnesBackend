import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const generateAccessToken = (userId: string, sessionId: string) => {
  return jwt.sign({ sub: userId, sid: sessionId }, env.BETTER_AUTH_SECRET, { expiresIn: '15m' });
};

export const verifyAccessToken = (token: string) => {
  try {
    return jwt.verify(token, env.BETTER_AUTH_SECRET) as { sub: string; sid: string };
  } catch (error) {
    return null;
  }
};
