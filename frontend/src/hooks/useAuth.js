import { useSelector, useDispatch } from 'react-redux';
import { setUser, setTokens, logout, setLoading, setError } from '../store/authSlice';
import { authService } from '../services';
import { extractErrorMessage } from '../utils';

export const useAuth = () => {
  const dispatch = useDispatch();
  const { user, tokens, isAuthenticated, loading, error } = useSelector((state) => state.auth);

  const login = async (email, password) => {
    dispatch(setLoading(true));
    try {
      const response = await authService.login(email, password);
      dispatch(setUser(response.data.user));
      const tokens = response.data.tokens || {
        access_token: response.data.token,
        refresh_token: response.data.token
      };
      dispatch(setTokens(tokens));
      dispatch(setError(null));
      return true;
    } catch (err) {
      dispatch(setError(extractErrorMessage(err) || 'Login failed'));
      return false;
    } finally {
      dispatch(setLoading(false));
    }
  };

  const register = async (email, password, firstName, lastName, role, hotspotSsid = null, hotspotBssid = null) => {
    dispatch(setLoading(true));
    try {
      await authService.register({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        role,
        hotspot_ssid: hotspotSsid,
        hotspot_bssid: hotspotBssid,
      });
      dispatch(setError(null));
      return true;
    } catch (err) {
      dispatch(setError(extractErrorMessage(err) || 'Registration failed'));
      return false;
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleLogout = () => {
    dispatch(logout());
  };

  return {
    user,
    tokens,
    isAuthenticated,
    loading,
    error,
    login,
    register,
    logout: handleLogout,
  };
};
