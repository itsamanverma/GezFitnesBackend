import { Queue } from 'bullmq';
import { redisClient } from '../config/redis.js';
export const emailQueue = new Queue('email', {
    connection: redisClient,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000, // 1s -> 5s -> 30s as per specs (exponential backoff)
        },
        removeOnComplete: true, // Clean up completed jobs to save Upstash memory
        removeOnFail: 100, // Keep last 100 failed jobs for inspection
    },
});
