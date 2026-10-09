import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import mongoose from 'mongoose';

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

  // CORS: allow configured production frontendUrl plus standard local dev origins
  const devOrigins = ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173'];
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || !config.isProduction) return callback(null, true);
        if (origin === config.frontendUrl || devOrigins.includes(origin)) return callback(null, true);
        return callback(null, true);
      },
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
    const isDbConnected = mongoose.connection.readyState === 1;
    res.status(isDbConnected ? 200 : 503).json({
      success: isDbConnected,
      status: isDbConnected ? 'ok' : 'degraded',
      database: isDbConnected ? 'connected' : 'disconnected',
      env: config.env,
      timestamp: new Date().toISOString(),
    });
  });

  // API routes
  app.use('/api/v1', routes);

  // 404 + error handling (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export default createApp;
