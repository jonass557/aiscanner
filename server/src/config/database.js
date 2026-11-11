import dns from 'dns';
import mongoose from 'mongoose';
import config from './index.js';
import logger from './logger.js';

const READY_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];
let lastDbError = null;
let lastDbErrorAt = null;
let dnsFallbackApplied = false;

const getSafeMongoTarget = (uri = '') => {
  if (!uri) return 'non défini';
  try {
    const clean = uri.replace(/^mongodb(\+srv)?:\/\/([^@]+@)?/, '');
    const hostPart = clean.split('/')[0].split('?')[0];
    return hostPart || 'inconnu';
  } catch {
    return 'inconnu';
  }
};

const sanitizeDbError = (message = '') =>
  String(message || '')
    .replace(/mongodb(\+srv)?:\/\/[^\s@]+@/gi, 'mongodb$1://***@')
    .slice(0, 300);

export const getDbDiagnostics = () => ({
  readyState: mongoose.connection.readyState,
  stateLabel: READY_STATES[mongoose.connection.readyState] || 'unknown',
  target: getSafeMongoTarget(config.mongo.uri),
  configSource: config.mongo.source || 'env',
  dnsFallbackApplied,
  lastError: lastDbError,
  lastErrorAt: lastDbErrorAt,
});

/**
 * Establishes the MongoDB connection with sensible pool settings and
 * graceful shutdown handling. Returns the mongoose connection.
 */
export const connectDB = async () => {
  try {
    mongoose.set('strictQuery', true);
    // Allow buffer commands with high tolerance so transient mobile drops don't fail immediately
    mongoose.set('bufferCommands', true);
    mongoose.set('bufferTimeoutMS', 30000);

    const conn = await mongoose.connect(config.mongo.uri, {
      // CloudLinux/cPanel shared hosting caps concurrent sockets & IPv6 routes often stall Atlas SRV
      maxPoolSize: 10,
      minPoolSize: 1,
      family: 4,
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      retryReads: true,
    });

    lastDbError = null;
    lastDbErrorAt = null;
    logger.info(`MongoDB connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      lastDbError = sanitizeDbError(err?.message);
      lastDbErrorAt = new Date().toISOString();
      logger.error(`MongoDB connection error: ${lastDbError}`);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected — attempting automatic reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      lastDbError = null;
      lastDbErrorAt = null;
      logger.info('MongoDB reconnected successfully.');
    });

    return conn;
  } catch (error) {
    const safeError = sanitizeDbError(error?.message);
    lastDbError = safeError;
    lastDbErrorAt = new Date().toISOString();

    // Some shared hosting local resolvers block or fail _mongodb._tcp SRV queries; switch to public DNS once.
    if (
      !dnsFallbackApplied &&
      config.mongo.uri.startsWith('mongodb+srv://') &&
      /querySrv|ESERVFAIL|ETIMEOUT|EREFUSED|ENOTFOUND/i.test(safeError)
    ) {
      try {
        dns.setServers(['8.8.8.8', '1.1.1.1']);
        dnsFallbackApplied = true;
        logger.warn('DNS SRV lookup failed with system resolver — switched to fallback DNS (8.8.8.8 / 1.1.1.1) for next retry.');
      } catch {
        // Ignore if environment forbids changing resolvers
      }
    }

    logger.error(`MongoDB connection failed (${getSafeMongoTarget(config.mongo.uri)} | source=${config.mongo.source}): ${safeError}`);
    logger.warn('Conseil MongoDB Atlas : vérifiez MONGODB_URI, le pare-feu sortant port 27017 de l\'hébergeur et l\'accès réseau (IP 0.0.0.0/0) sur Atlas.');
    throw error;
  }
};

export const disconnectDB = async () => {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
};

export const cloudinaryConfig = config.cloudinary;
