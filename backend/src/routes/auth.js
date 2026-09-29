const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, verifyToken } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { identifier, password, role } = req.body;
    // identifier can be phone or email

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Phone/Email and password are required' });
    }

    const query = 'SELECT * FROM users WHERE (phone = ? OR email = ?)';
    const user = await db.prepare(query).get(identifier.trim(), identifier.trim());

    if (!user) {
      return res.status(401).json({ error: 'Invalid phone/email or password' });
    }

    // If role is explicitly specified in login request, check role match
    if (role && user.role !== role) {
      return res.status(401).json({
        error: `Account is registered as ${user.role}, not ${role}. Please use the ${user.role} login.`
      });
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid phone/email or password' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        address: user.address,
        role: user.role
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/register (User self-registration only)
router.post('/register', async (req, res, next) => {
  try {
    const { name, phone, address, password } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({ error: 'Name, phone number, and password are required' });
    }

    // Validate phone
    const cleanPhone = phone.trim();
    if (cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit phone number' });
    }

    // Check if phone already registered
    const existing = await db.prepare('SELECT id FROM users WHERE phone = ?').get(cleanPhone);
    if (existing) {
      return res.status(409).json({ error: 'Phone number already registered. Please log in.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);

    const insertStmt = db.prepare(`
      INSERT INTO users (name, phone, address, password_hash, role)
      VALUES (?, ?, ?, ?, 'user')
    `);
    const info = await insertStmt.run(name.trim(), cleanPhone, address ? address.trim() : '', password_hash);

    const newUser = {
      id: info.lastInsertRowid,
      name: name.trim(),
      phone: cleanPhone,
      address: address ? address.trim() : '',
      role: 'user'
    };

    const token = jwt.sign(
      { id: newUser.id, role: newUser.role, name: newUser.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Account registered successfully',
      token,
      user: newUser
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, (req, res) => {
  return res.json({ user: req.user });
});

// GET /api/auth/demo-accounts (convenience helper for fast evaluation)
router.get('/demo-accounts', (req, res) => {
  const accounts = [
    {
      role: 'owner',
      title: 'Business Owner / Admin',
      identifier: '9999999999',
      password: 'owner123',
      name: 'Rajesh Sharma (Owner)'
    },
    {
      role: 'user',
      title: 'Customer 1 (Sri Krishna Bakery)',
      identifier: '9876543211',
      password: 'user123',
      name: 'Sri Krishna Bakery'
    },
    {
      role: 'user',
      title: 'Customer 2 (Anand Supermarket)',
      identifier: '9876543212',
      password: 'user123',
      name: 'Anand Supermarket'
    },
    {
      role: 'user',
      title: 'Customer 3 (Hotel Annapurna)',
      identifier: '9876543213',
      password: 'user123',
      name: 'Hotel Annapurna'
    },
    {
      role: 'user',
      title: 'Customer 4 (Ramesh Dhabha)',
      identifier: '9876543214',
      password: 'user123',
      name: 'Ramesh Dhabha'
    }
  ];
  return res.json({ demoAccounts: accounts });
});

module.exports = router;
