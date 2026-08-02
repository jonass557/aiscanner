import winston from 'winston';
import config from './index.js';

/**
 * Application-wide structured logger.
 * In development it prints colorized, human-readable lines.
 * In production it emits JSON for easy ingestion by log aggregators.
 */
const { combine, timestamp, printf, colorize, json, errors } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack }) => {
    return `${ts} ${level}: ${stack || message}`;
  })
);

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

const logger = winston.createLogger({
  level: config.isProduction ? 'info' : 'debug',
  format: config.isProduction ? prodFormat : devFormat,
  transports: [new winston.transports.Console()],
  silent: config.isTest,
});

export default logger;
