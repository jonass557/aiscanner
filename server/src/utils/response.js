/**
 * Standard success response envelope.
 * All controllers return data through this so the frontend can rely on
 * a consistent shape: { success, message, data, meta }.
 */
export const sendSuccess = (res, { statusCode = 200, message = 'Success', data = null, meta = null } = {}) => {
  const payload = { success: true, message };
  if (data !== null) payload.data = data;
  if (meta !== null) payload.meta = meta;
  return res.status(statusCode).json(payload);
};

/**
 * Standard error response envelope, used by the global error handler.
 */
export const error = (res, statusCode = 500, message = 'Error', details = null, stack = null) => {
  const payload = { success: false, message };
  if (details) payload.details = details;
  if (stack) payload.stack = stack;
  return res.status(statusCode).json(payload);
};
