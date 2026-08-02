import Log from '../models/Log.js';
import logger from '../config/logger.js';

/**
 * Persists an audit/system log entry to MongoDB (surfaced in the admin panel)
 * while also echoing to the console logger. Never throws — logging failures
 * must not break the request flow.
 */
export const recordLog = async ({ level = 'info', category, action, message, userId = null, metadata = null, ip = null }) => {
  try {
    await Log.create({ level, category, action, message, userId, metadata, ip });
  } catch (err) {
    logger.warn(`Failed to persist log: ${err.message}`);
  }
};

export const logAuth = (action, { message, userId, ip, level = 'info' } = {}) =>
  recordLog({ level, category: 'auth', action, message, userId, ip });

export const logAi = (action, { message, userId, metadata, level = 'info' } = {}) =>
  recordLog({ level, category: 'ai', action, message, userId, metadata });

export const logAdmin = (action, { message, userId, metadata, ip } = {}) =>
  recordLog({ level: 'info', category: 'admin', action, message, userId, metadata, ip });

export const logScan = (action, { message, userId, metadata, level = 'info' } = {}) =>
  recordLog({ level, category: 'scan', action, message, userId, metadata });
