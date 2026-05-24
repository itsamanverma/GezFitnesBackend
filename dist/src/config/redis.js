import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';
// Setup connection options
const redisOptions = {
    maxRetriesPerRequest: null, // Required by BullMQ
    // Upstash Redis requires TLS in the cloud. Check if URL starts with rediss://
    ...(env.UPSTASH_REDIS_URL.startsWith('rediss://')
        ? { tls: { rejectUnauthorized: false } }
        : {}),
};
export const redisClient = new Redis(env.UPSTASH_REDIS_URL, redisOptions);
redisClient.on('connect', () => {
    logger.info('Successfully connected to Redis');
});
redisClient.on('error', (err) => {
    logger.error(`Redis connection error: ${err}`);
});
