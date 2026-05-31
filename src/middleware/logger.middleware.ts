import pinoHttpImport from 'pino-http';
import { logger } from '../utils/logger.js';
import { IncomingMessage, ServerResponse } from 'http';

export const loggerMiddleware = (pinoHttpImport as any)({
  logger,
  genReqId: (req: IncomingMessage) => {
    return req.headers['x-request-id'] || req.headers['X-Request-ID'] || '';
  },
  customLogLevel: (req: IncomingMessage, res: ServerResponse, err: Error) => {
    if (res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: (req: any) => ({
      method: req.method,
      url: req.url,
      headers: {
        'x-request-id': req.headers['x-request-id'] || req.headers['X-Request-ID'],
      },
    }),
    res: (res: any) => ({
      statusCode: res.statusCode,
    }),
  },
});
