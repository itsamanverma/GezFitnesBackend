import { v4 as uuidv4 } from 'uuid';
export function requestIdMiddleware(req, res, next) {
    const requestId = (req.header('x-request-id') || req.header('X-Request-ID') || uuidv4());
    // Set in request context/headers and response headers
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
}
