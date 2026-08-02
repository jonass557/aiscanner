import multer from 'multer';
import config from '../config/index.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Multer configured for in-memory storage: the file buffer is passed straight
 * to the upload service (Cloudinary). Validates MIME type and size.
 */
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (config.upload.allowedFormats.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(ApiError.badRequest('Unsupported file format. Allowed: PNG, JPEG, JPG, WEBP.'), false);
  }
};

export const uploadSingle = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.upload.maxFileSize },
}).single('image');

/**
 * Accepts up to 6 images under the "images" field (multi-timeframe scan).
 */
export const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.upload.maxFileSize, files: 6 },
}).array('images', 6);

/**
 * Wraps multer so its errors become ApiErrors handled by the global handler.
 */
export const handleUpload = (req, res, next) => {
  uploadSingle(req, res, (err) => {
    if (err) return next(err);
    if (!req.file) return next(ApiError.badRequest('No image file provided.'));
    next();
  });
};

/**
 * Wraps the multi-image uploader for the multi-timeframe endpoint.
 */
export const handleMultiUpload = (req, res, next) => {
  uploadMultiple(req, res, (err) => {
    if (err) return next(err);
    if (!req.files || req.files.length === 0) {
      return next(ApiError.badRequest('No image files provided.'));
    }
    next();
  });
};

/**
 * Accepts an audio clip under the "audio" field (voice assistant STT).
 */
const audioUpload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // Whisper's 25MB limit
}).single('audio');

export const handleAudioUpload = (req, res, next) => {
  audioUpload(req, res, (err) => {
    if (err) return next(err);
    if (!req.file) return next(ApiError.badRequest('No audio file provided.'));
    next();
  });
};
