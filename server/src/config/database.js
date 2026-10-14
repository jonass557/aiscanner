import mongoose from 'mongoose';
import config from './index.js';
import logger from './logger.js';

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
      maxPoolSize: 20,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      retryReads: true,
    });

    logger.info(`MongoDB connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected — attempting automatic reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected successfully.');
    });

    return conn;
  } catch (error) {
    logger.error(`MongoDB connection failed (${config.mongo.uri}): ${error.message}`);
    logger.warn('Conseil MongoDB Atlas : vérifiez que l\'accès réseau est autorisé (IP 0.0.0.0/0) dans Atlas -> Network Access et que le cluster est bien actif.');
    throw error;
  }
};

export const disconnectDB = async () => {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
};

export const cloudinaryConfig = config.cloudinary;
