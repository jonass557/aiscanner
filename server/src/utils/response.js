/**
 * Standard success response envelope.
 * All controllers return data through this so the frontend can rely on
 * a consistent shape: { success, message, data, meta }.
 */
export const sendSuccess = (res, optionsOrCode = {}, maybeData = null) => {
  // Support both sendSuccess(res, { statusCode, message, data, meta })
  // and legacy/alternative sendSuccess(res, 200, { config, message })
  if (typeof optionsOrCode === 'number') {
    const statusCode = optionsOrCode;
    let message = 'Success';
    let data = null;
    let meta = null;

    if (maybeData && typeof maybeData === 'object' && !Array.isArray(maybeData)) {
      if (typeof maybeData.message === 'string') {
        message = maybeData.message;
      }
      if (maybeData.meta !== undefined) {
        meta = maybeData.meta;
      }
      if (maybeData.data !== undefined) {
        data = maybeData.data;
      } else {
        const { message: _m, meta: _meta, ...rest } = maybeData;
        data = Object.keys(rest).length > 0 ? rest : (maybeData.data !== undefined ? maybeData.data : maybeData);
      }
    } else if (maybeData !== null && maybeData !== undefined) {
      data = maybeData;
    }

    const payload = { success: true, message };
    if (data !== null) payload.data = data;
    if (meta !== null) payload.meta = meta;
    return res.status(statusCode).json(payload);
  }

  const { statusCode = 200, message = 'Success', data = null, meta = null } = optionsOrCode || {};
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
