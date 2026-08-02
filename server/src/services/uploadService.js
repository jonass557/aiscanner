import { v2 as cloudinary } from 'cloudinary';
import config from '../config/index.js';
import logger from '../config/logger.js';

/**
 * Cloudinary upload service. Configures the SDK from central config and
 * exposes upload/delete helpers. Uploads accept a Buffer (from multer memory
 * storage) via an upload_stream.
 */

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
});

export const isCloudinaryConfigured = () =>
  Boolean(config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret);

/**
 * Uploads an image buffer to Cloudinary.
 * @param {Buffer} buffer
 * @param {string} userId - used to namespace uploads per user
 * @returns {Promise<{ url: string, publicId: string }>}
 */
export const uploadImage = (buffer, userId) =>
  new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured()) {
      // Dev fallback: return a data URL so the flow still works without Cloudinary.
      const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
      logger.warn('Cloudinary not configured; using inline data URL (development only).');
      return resolve({ url: dataUrl, publicId: null });
    }

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${config.cloudinary.folder}/${userId}`,
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });

export const deleteImage = async (publicId) => {
  if (!publicId || !isCloudinaryConfigured()) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    logger.warn(`Failed to delete Cloudinary image ${publicId}: ${err.message}`);
  }
};
