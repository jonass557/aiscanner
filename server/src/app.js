import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';

import config from './config/index.js';
import logger from './config/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import routes from './routes/index.js';

/**
 * Builds and configures the Express application.
 * Kept separate from server.js so tests can import the app without
 * starting a listening socket.
 */
const createApp = () => {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS
  app.use(
    cors({
      origin: config.isProduction ? config.frontendUrl : true,
      credentials: true,
    })
  );

  // Body parsing. Capture the raw body so webhook HMAC signatures can be
  // verified against the exact bytes received (SebPay payment webhooks).
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        req.rawBody = buf.toString('utf8');
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Sanitize against NoSQL injection
  app.use(mongoSanitize());

  // HTTP request logging
  if (!config.isTest) {
    app.use(
      morgan(config.isProduction ? 'combined' : 'dev', {
        stream: { write: (msg) => logger.http?.(msg.trim()) ?? logger.info(msg.trim()) },
      })
    );
  }

  // Rate limiting
  app.use('/api', apiLimiter);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ success: true, status: 'ok', env: config.env, timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api/v1', routes);

  // 404 + error handling (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export default createApp;
