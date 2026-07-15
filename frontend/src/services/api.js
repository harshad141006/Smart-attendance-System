import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add interceptor to include token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    }

    // Normalize validation and other non-string errors to strings
    if (error.response?.data) {
      const data = error.response.data;
      if (data.detail && typeof data.detail !== 'string') {
        if (Array.isArray(data.detail)) {
          data.detail = data.detail
            .map((d) => {
              if (typeof d === 'string') return d;
              if (d && typeof d === 'object') {
                const field = d.loc ? d.loc[d.loc.length - 1] : null;
                return field ? `${field}: ${d.msg}` : d.msg || JSON.stringify(d);
              }
              return String(d);
            })
            .join(', ');
        } else if (typeof data.detail === 'object') {
          data.detail = data.detail.message || JSON.stringify(data.detail);
        }
      }
      if (data.error && typeof data.error !== 'string') {
        if (typeof data.error === 'object') {
          data.error = data.error.message || JSON.stringify(data.error);
        } else {
          data.error = String(data.error);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
