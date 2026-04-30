const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { validateEmail, validatePassword, validateRequired, validateAccountType } = require('../utils/validators');
const { generateOTP, sendOTP } = require('../utils/mailer');

const router = express.Router();

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, account_type } = req.body;

    // Validate required fields
    const reqErr = validateRequired(['name', 'email', 'password', 'account_type'], req.body);
    if (reqErr) return res.status(400).json({ error: reqErr });

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    const pwErr = validatePassword(password);
    if (pwErr) return res.status(400).json({ error: pwErr });

    const typeErr = validateAccountType(account_type);
    if (typeErr) return res.status(400).json({ error: typeErr });

    // Check duplicate
    const existing = await pool.query('SELECT id, is_verified FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      if (user.is_verified) {
        return res.status(409).json({ error: 'Email already registered.' });
      }
      // If not verified, delete the old record and allow re-registration
      await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Insert user (unverified)
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, account_type, is_verified, otp_code, otp_expires_at)
       VALUES ($1, $2, $3, $4, false, $5, $6)
       RETURNING id, name, email, account_type`,
      [name.trim(), email.toLowerCase().trim(), passwordHash, account_type, otp, otpExpires]
    );

    // Send OTP email
    await sendOTP(email.toLowerCase().trim(), otp);

    res.status(201).json({
      message: 'Account created. Please check your email for the verification code.',
      requiresVerification: true,
      email: email.toLowerCase().trim(),
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    const reqErr = validateRequired(['email', 'otp'], req.body);
    if (reqErr) return res.status(400).json({ error: reqErr });

    const result = await pool.query(
      'SELECT id, name, email, account_type, otp_code, otp_expires_at, is_verified FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No account found with this email.' });
    }

    const user = result.rows[0];

    if (user.is_verified) {
      return res.status(400).json({ error: 'Account is already verified.' });
    }

    if (user.otp_code !== otp.trim()) {
      return res.status(400).json({ error: 'Invalid OTP code.' });
    }

    if (new Date() > new Date(user.otp_expires_at)) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    // Mark as verified and clear OTP
    await pool.query(
      'UPDATE users SET is_verified = true, otp_code = NULL, otp_expires_at = NULL WHERE id = $1',
      [user.id]
    );

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Email verified successfully!',
      token,
      user: { id: user.id, name: user.name, email: user.email, account_type: user.account_type },
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/resend-otp
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;

    const reqErr = validateRequired(['email'], req.body);
    if (reqErr) return res.status(400).json({ error: reqErr });

    const result = await pool.query(
      'SELECT id, is_verified FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No account found with this email.' });
    }

    const user = result.rows[0];

    if (user.is_verified) {
      return res.status(400).json({ error: 'Account is already verified.' });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      'UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE id = $3',
      [otp, otpExpires, user.id]
    );

    // Send OTP email
    await sendOTP(email.toLowerCase().trim(), otp);

    res.json({ message: 'A new OTP has been sent to your email.' });
  } catch (err) {
    console.error('Resend OTP error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const reqErr = validateRequired(['email', 'password'], req.body);
    if (reqErr) return res.status(400).json({ error: reqErr });

    const result = await pool.query(
      'SELECT id, name, email, password_hash, account_type, is_verified FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check if verified
    if (!user.is_verified) {
      return res.status(403).json({
        error: 'Email not verified. Please verify your email first.',
        requiresVerification: true,
        email: user.email,
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, account_type: user.account_type },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, account_type, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
