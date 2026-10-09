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
    // Disable command buffering so queries immediately fail if DB is not connected
    // instead of hanging for 60 seconds (which triggers client timeout 60000ms).
    mongoose.set('bufferCommands', false);

    const conn = await mongoose.connect(config.mongo.uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info(`MongoDB connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
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
