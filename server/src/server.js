import createApp from './app.js';
import config from './config/index.js';
import logger from './config/logger.js';
import { connectDB, disconnectDB } from './config/database.js';
import { startScanner, stopScanner } from './services/opportunityScanner.js';
import { startCalendarRefresh, stopCalendarRefresh } from './services/economicCalendarService.js';
import { seedPlans } from './services/planService.js';
import { hydrate as hydrateSettings } from './services/settings/settingsService.js';

/**
 * Server bootstrap: connect to the database, start listening, and wire up
 * graceful shutdown on process signals.
 */
const start = async () => {
  try {
    await connectDB();

    // Seed subscription plans into the DB on first boot (idempotent).
    await seedPlans();

    // Overlay admin-edited runtime settings (API keys, active providers) onto
    // config. Env remains the fallback; DB values override when present.
    await hydrateSettings();

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
    });

    // Start background jobs (skipped in test env).
    if (!config.isTest) {
      startScanner();
      startCalendarRefresh();
    }

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
