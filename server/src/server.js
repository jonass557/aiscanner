import createApp from './app.js';
import config from './config/index.js';
import logger from './config/logger.js';
import { connectDB, disconnectDB } from './config/database.js';
import { startScanner, stopScanner } from './services/opportunityScanner.js';
import { startCalendarRefresh, stopCalendarRefresh } from './services/economicCalendarService.js';
import { seedPlans } from './services/planService.js';
import { hydrate as hydrateSettings } from './services/settings/settingsService.js';
import { isRealProviderConfigured } from './services/ai/index.js';

/**
 * Server bootstrap: connect to the database, start listening, and wire up
 * graceful shutdown on process signals.
 */
const start = async () => {
  try {
    const app = createApp();
    const server = app.listen(config.port, () => {
      logger.info(`Server running in ${config.env} mode on port ${config.port}`);
      // Surface email/verification config so misconfig is obvious in host logs.
      const emailMode = config.email.resendApiKey
        ? 'Resend API (HTTP)'
        : config.email.user && config.email.password
          ? `SMTP (${config.email.host}:${config.email.port} as ${config.email.user})`
          : 'DISABLED (mock — OTP printed to console)';
      logger.info(
        `Email: ${emailMode} | from: ${config.email.from} | ` +
        `Email verification required: ${config.features.requireEmailVerification}`
      );
      // Surface the EFFECTIVE AI provider so a missing/overridden key is obvious.
      const keyPresent = {
        openai: Boolean(config.ai.openai.apiKey),
        claude: Boolean(config.ai.claude.apiKey),
        gemini: Boolean(config.ai.gemini.apiKey),
      };
      logger.info(
        `AI: provider=${config.ai.provider} | keys{openai:${keyPresent.openai} ` +
        `claude:${keyPresent.claude} gemini:${keyPresent.gemini}} | ` +
        `vision-ready:${isRealProviderConfigured()}`
      );
    });

    let isInitialized = false;

    const initServices = async () => {
      if (isInitialized) return;
      try {
        await connectDB();
        // Seed subscription plans into the DB on first boot (idempotent).
        await seedPlans();
        // Overlay admin-edited runtime settings onto config.
        await hydrateSettings();

        // Start background jobs (skipped in test env).
        if (!config.isTest) {
          startScanner();
          startCalendarRefresh();
        }
        isInitialized = true;
        logger.info('Database and services successfully initialized.');
      } catch (error) {
        logger.warn(`Database connection failed: ${error.message}. Retrying in 5 seconds...`);
        setTimeout(initServices, 5000).unref();
      }
    };

    // Kick off DB connection and service initialization in background
    initServices();

    const shutdown = async (signal) => {
      logger.info(`${signal} received, shutting down gracefully...`);
      stopScanner();
      stopCalendarRefresh();
      server.close(async () => {
        await disconnectDB();
        process.exit(0);
      });
      // Force exit if graceful shutdown hangs
      setTimeout(() => process.exit(1), 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      logger.error(`Unhandled Rejection: ${reason}`);
    });
    process.on('uncaughtException', (err) => {
      logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
      process.exit(1);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

start();
