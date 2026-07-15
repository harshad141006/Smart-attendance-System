import { createSlice } from '@reduxjs/toolkit';

const token = localStorage.getItem('access_token');
const savedUser = localStorage.getItem('auth_user');

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: savedUser ? JSON.parse(savedUser) : null,
    tokens: token ? { access_token: token, refresh_token: localStorage.getItem('refresh_token') || '' } : null,
    isAuthenticated: !!token,
    loading: false,
    error: null,
  },
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload;
      if (action.payload) {
        localStorage.setItem('auth_user', JSON.stringify(action.payload));
      }
    },
    setTokens: (state, action) => {
      state.tokens = action.payload;
      state.isAuthenticated = true;
      localStorage.setItem('access_token', action.payload.access_token);
      localStorage.setItem('refresh_token', action.payload.refresh_token || '');
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.tokens = null;
      state.isAuthenticated = false;
      state.error = null;
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('auth_user');
    },
  },
});

export const {
  setUser,
  setTokens,
  setLoading,
  setError,
  logout,
} = authSlice.actions;

export default authSlice.reducer;
