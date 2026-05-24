import { AppError } from '../utils/errors.js';
import { error as sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
export function errorMiddleware(err, req, res, next) {
    // Use Pino logger for error logging
    logger.error({ err, requestId: req.headers['x-request-id'] }, 'Express request error');
    if (err instanceof AppError) {
        return sendError(res, err.code, err.message, err.statusCode, env.NODE_ENV === 'development' ? err.details : undefined);
    }
    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
        return sendError(res, 'VALIDATION_ERROR', err.message, 400, env.NODE_ENV === 'development' ? err.errors : undefined);
    }
    // Handle Mongoose duplicate key error
    if (err.code === 11000) {
        return sendError(res, 'CONFLICT', 'Resource already exists', 409, env.NODE_ENV === 'development' ? err.keyValue : undefined);
    }
    // Fallback for unhandled internal exceptions
    return sendError(res, 'INTERNAL_ERROR', 'An unexpected error occurred. Please try again later.', 500, env.NODE_ENV === 'development' ? { message: err.message, stack: err.stack } : undefined);
}
