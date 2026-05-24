export function success(res, data, message, statusCode = 200, meta) {
    return res.status(statusCode).json({
        success: true,
        data,
        ...(message ? { message } : {}),
        ...(meta ? { meta } : {}),
    });
}
export function error(res, code, message, statusCode = 500, details) {
    return res.status(statusCode).json({
        success: false,
        error: {
            code,
            message,
            ...(details ? { details } : {}),
        },
    });
}
