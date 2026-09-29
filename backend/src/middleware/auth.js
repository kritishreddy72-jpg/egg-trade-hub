const jwt = require('jsonwebtoken');
const db = require('../db');

const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

// Enforce JWT_SECRET strictly from environment variables in production, with no hardcoded fallback
if (isProduction && !process.env.JWT_SECRET) {
  console.error('FATAL CONFIGURATION ERROR: JWT_SECRET environment variable is missing in production!');
  throw new Error('JWT_SECRET environment variable is strictly required in production.');
}

const JWT_SECRET = process.env.JWT_SECRET || 'egg-trade-secret-key-super-secure-2026';

async function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Invalid token format. Format must be: Bearer <token>' });
  }

  const token = parts[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.prepare('SELECT id, name, phone, email, address, role FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User associated with token no longer exists' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireOwner(req, res, next) {
  if (!req.user || req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Access denied: Owner privileges required' });
  }
  next();
}

function requireUser(req, res, next) {
  if (!req.user || req.user.role !== 'user') {
    return res.status(403).json({ error: 'Access denied: Customer user role required' });
  }
  next();
}

module.exports = {
  JWT_SECRET,
  verifyToken,
  requireOwner,
  requireUser
};
