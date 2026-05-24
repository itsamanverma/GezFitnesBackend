import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
export const generateAccessToken = (userId, sessionId) => {
    return jwt.sign({ sub: userId, sid: sessionId }, env.BETTER_AUTH_SECRET, { expiresIn: '15m' });
};
export const verifyAccessToken = (token) => {
    try {
        return jwt.verify(token, env.BETTER_AUTH_SECRET);
    }
    catch (error) {
        return null;
    }
};
