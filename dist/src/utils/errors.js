export class AppError extends Error {
    message;
    statusCode;
    code;
    details;
    constructor(message, statusCode, code, details) {
        super(message);
        this.message = message;
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}
export class BadRequestError extends AppError {
    constructor(message = 'Bad Request', code = 'BAD_REQUEST', details) {
        super(message, 400, code, details);
    }
}
export class ValidationError extends AppError {
    constructor(message = 'Validation Error', details) {
        super(message, 400, 'VALIDATION_ERROR', details);
    }
}
export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
        super(message, 401, code);
    }
}
export class ForbiddenError extends AppError {
    constructor(message = 'Forbidden', code = 'FORBIDDEN') {
        super(message, 403, code);
    }
}
export class NotFoundError extends AppError {
    constructor(message = 'Resource not found', code = 'NOT_FOUND') {
        super(message, 404, code);
    }
}
export class ConflictError extends AppError {
    constructor(message = 'Conflict', code = 'CONFLICT') {
        super(message, 409, code);
    }
}
export class GoneError extends AppError {
    constructor(message = 'Gone', code = 'GONE') {
        super(message, 410, code);
    }
}
export class TooManyRequestsError extends AppError {
    constructor(message = 'Rate limit exceeded', code = 'RATE_LIMITED') {
        super(message, 429, code);
    }
}
export class ServiceUnavailableError extends AppError {
    constructor(message = 'Service unavailable', code = 'SERVICE_UNAVAILABLE') {
        super(message, 503, code);
    }
}
