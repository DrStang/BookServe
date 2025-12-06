/**
 * Auth utility functions for BookServe
 * Works with JWT tokens stored in localStorage
 */

/**
 * Get the current auth token from localStorage
 */
export const getToken = () => {
  return localStorage.getItem('token');
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = () => {
  const token = getToken();
  if (!token) return false;
  
  try {
    const payload = parseJwt(token);
    // Check if token is expired
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('token');
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

/**
 * Get the current user from the JWT token
 * Returns null if not authenticated
 */
export const getCurrentUser = () => {
  const token = getToken();
  if (!token) return null;
  
  try {
    const payload = parseJwt(token);
    return {
      id: payload.id || payload.userId,
      username: payload.username,
      email: payload.email,
      role: payload.role || 'user',
    };
  } catch {
    return null;
  }
};

/**
 * Check if current user is an admin
 */
export const isAdmin = () => {
  const user = getCurrentUser();
  return user?.role === 'admin';
};

/**
 * Parse a JWT token and return the payload
 */
const parseJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return {};
  }
};

/**
 * Logout - clear token and redirect
 */
export const logout = () => {
  localStorage.removeItem('token');
  window.location.href = '/login';
};

export default {
  getToken,
  isAuthenticated,
  getCurrentUser,
  isAdmin,
  logout,
};
