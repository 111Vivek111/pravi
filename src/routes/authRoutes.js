const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user || !user.is_active) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const passwordMatches = bcrypt.compareSync(password, user.password_hash);
  if (!passwordMatches) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const payload = { id: user.id, role: user.role, email: user.email };
  const token = jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: user.is_active
    }
  });
});

router.get('/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
