/**
 * Helper to safely extract a human-readable string error message
 * from various backend/API error response formats or standard JS errors.
 */
export const extractErrorMessage = (err) => {
  if (!err) return '';

  // If it's already a string, return it
  if (typeof err === 'string') return err;

  // If it's an Axios/API error with a response
  if (err.response?.data) {
    const data = err.response.data;

    // Check for error property
    if (data.error) {
      if (typeof data.error === 'string') return data.error;
      if (typeof data.error === 'object') {
        return data.error.message || JSON.stringify(data.error);
      }
    }

    // Check for detail property (common in FastAPI)
    if (data.detail) {
      if (typeof data.detail === 'string') return data.detail;

      if (Array.isArray(data.detail)) {
        return data.detail
          .map((d) => {
            if (typeof d === 'string') return d;
            if (d && typeof d === 'object') {
              const field = d.loc ? d.loc[d.loc.length - 1] : null;
              return field ? `${field}: ${d.msg}` : d.msg || JSON.stringify(d);
            }
            return String(d);
          })
          .join(', ');
      }

      if (typeof data.detail === 'object') {
        return data.detail.message || JSON.stringify(data.detail);
      }
    }

    // Fallback to response message or stringified data
    if (data.message && typeof data.message === 'string') return data.message;
  }

  // If it's a validation error object directly
  if (typeof err === 'object') {
    if (err.msg && typeof err.msg === 'string') {
      const field = err.loc ? err.loc[err.loc.length - 1] : null;
      return field ? `${field}: ${err.msg}` : err.msg;
    }
  }

  // If the error object has a message property
  if (err.message && typeof err.message === 'string') return err.message;

  // Final fallback
  try {
    return JSON.stringify(err);
  } catch (e) {
    return String(err);
  }
};
