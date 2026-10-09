import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';

/**
 * Middleware that checks if MongoDB is connected.
 * If disconnected, it immediately rejects the request with a 503 Service Unavailable
 * instead of letting Mongoose hang or buffer queries until Axios hits its timeout (60000ms).
 */
export const requireDbConnection = (req, res, next) => {
  // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  if (mongoose.connection.readyState !== 1) {
    return next(
      ApiError.serviceUnavailable(
        'La base de données MongoDB est actuellement indisponible ou en cours de connexion. ' +
        'Veuillez vérifier la configuration MONGODB_URI et autoriser l\'accès réseau (IP 0.0.0.0/0) sur MongoDB Atlas.'
      )
    );
  }
  next();
};
