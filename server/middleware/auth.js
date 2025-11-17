const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid authentication token' });
  }
};

// Middleware that accepts auth token from either header OR query parameter
// This is needed for resources loaded by <img> tags and ReactReader which can't set headers
const authMiddlewareFlexible = async (req, res, next) => {
  try {
    // Try to get token from Authorization header first
    let token = req.header('Authorization')?.replace('Bearer ', '');

    // If not in header, try query parameter
    if (!token) {
      token = req.query.token;
    }

    console.log('[authMiddlewareFlexible] Request URL:', req.url);
    console.log('[authMiddlewareFlexible] Token from query:', req.query.token ? 'present' : 'missing');
    console.log('[authMiddlewareFlexible] Token from header:', req.header('Authorization') ? 'present' : 'missing');

    if (!token) {
      console.log('[authMiddlewareFlexible] No token found - returning 401');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      console.log('[authMiddlewareFlexible] User not found - returning 401');
      return res.status(401).json({ error: 'User not found' });
    }

    console.log('[authMiddlewareFlexible] Authentication successful for user:', user.username);
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.log('[authMiddlewareFlexible] Error:', error.message);
    res.status(401).json({ error: 'Invalid authentication token' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = { authMiddleware, authMiddlewareFlexible, adminMiddleware };
