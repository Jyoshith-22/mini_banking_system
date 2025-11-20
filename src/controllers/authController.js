// src/controllers/authController.js
const pool = require('../models/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_EXP = '8h';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

console.log('=== AUTH CONTROLLER LOADED ===');
console.log('JWT_SECRET is set:', !!process.env.JWT_SECRET);
console.log('Using JWT_SECRET:', JWT_SECRET);

// small dummy hash used to equalize bcrypt timing when user not found
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8mZ0yq0h1pQ1u1q1u1q1u1q1u1q1u';

function safeEmail(input) {
  if (!input || typeof input !== 'string') return '';
  return input.trim().toLowerCase();
}

exports.register = async (req, res, next) => {
  try {
    const rawName = req.body && req.body.name;
    const rawEmail = req.body && req.body.email;
    const rawPassword = req.body && req.body.password;

    const name = rawName && String(rawName).trim();
    const email = safeEmail(rawEmail);
    const password = rawPassword && String(rawPassword);

    console.log('[REGISTER] Received:', { 
      name, 
      email, 
      password_length: password ? password.length : 0 
    });

    // basic guard (server-side)
    if (!name || !email || !password || password.length < 6) {
      return res.status(400).json({ error: 'Invalid input: name, email and password (>=6 chars) are required' });
    }

    // Check existing user (email normalized)
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      console.log('[REGISTER] Email already exists:', email);
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password with cost 10
    console.log('[REGISTER] Hashing password...');
    const password_hash = await bcrypt.hash(password, 10);
    console.log('[REGISTER] Password hashed, length:', password_hash.length);

    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, balance) VALUES (?, ?, ?, 0)',
      [name, email, password_hash]
    );

    const user = { id: result.insertId, name, email };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXP });

    console.log('[REGISTER] SUCCESS - User ID:', result.insertId);
    console.log('[REGISTER] Token created with secret:', JWT_SECRET);
    
    // Return token + user (no password hash)
    res.json({ user, token });
  } catch (err) {
    console.error('[REGISTER] ERROR:', err);
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const rawEmail = req.body && req.body.email;
    const rawPassword = req.body && req.body.password;

    const email = safeEmail(rawEmail);
    const password = rawPassword && String(rawPassword);

    console.log('[LOGIN] Attempt for email:', email);
    console.log('[LOGIN] Password length:', password ? password.length : 0);

    if (!email || !password) {
      console.log('[LOGIN] Missing email or password');
      return res.status(400).json({ error: 'Email and password required' });
    }

    const [rows] = await pool.query('SELECT id, name, email, password_hash FROM users WHERE email = ?', [email]);

    if (!rows.length) {
      console.log('[LOGIN] FAILED - No user found for email:', email);
      // run a dummy bcrypt compare to make timing similar to the "user exists" path
      try { await bcrypt.compare(password, DUMMY_HASH); } catch (e) { /* ignore */ }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    console.log('[LOGIN] User found - ID:', user.id, 'Email:', user.email);
    console.log('[LOGIN] Stored hash length:', user.password_hash ? user.password_hash.length : 0);
    console.log('[LOGIN] Comparing password...');
    
    const match = await bcrypt.compare(password, user.password_hash);
    console.log('[LOGIN] Password match:', match);

    if (!match) {
      console.log('[LOGIN] FAILED - Password mismatch for user:', user.id);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXP });
    console.log('[LOGIN] SUCCESS - Token created for user:', user.id);
    console.log('[LOGIN] Token created with secret:', JWT_SECRET);
    
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('[LOGIN] ERROR:', err);
    next(err);
  }
};