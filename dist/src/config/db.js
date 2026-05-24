import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';
// Connect to MongoDB Atlas immediately (top-level await)
try {
    logger.info('Connecting to MongoDB Atlas...');
    await mongoose.connect(env.MONGODB_URI, {
        autoIndex: true,
    });
    logger.info('Successfully connected to MongoDB Atlas');
}
catch (err) {
    logger.error(`MongoDB connection failed: ${err}`);
    process.exit(1);
}
export const db = mongoose.connection.db;
export const client = mongoose.connection.getClient();
export async function disconnectDb() {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB Atlas');
}
