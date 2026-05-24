import pinoHttp from 'pino-http';
import { logger } from '../utils/logger.js';
import { IncomingMessage } from 'http';

export const loggerMiddleware = pinoHttp({
  logger,
  genReqId: (req: IncomingMessage) => {
    return req.headers['x-request-id'] || req.headers['X-Request-ID'] || '';
  },
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: {
        'x-request-id': req.headers['x-request-id'] || req.headers['X-Request-ID'],
      },
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});
