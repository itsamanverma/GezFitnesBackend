import http from 'http';
import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { createSocketServer } from './config/socket.js';
// Import email worker to start processing queued background jobs
import './jobs/workers/email.worker.js';
const port = env.PORT;
const httpServer = http.createServer(app);
// Attach Socket.IO
createSocketServer(httpServer);
httpServer.listen(port, () => {
    logger.info(`Server is running in ${env.NODE_ENV} mode on port ${port}`);
    logger.info(`API Base URL: ${env.APP_URL}`);
    logger.info(`Socket.IO is ready for Live Sessions`);
});
