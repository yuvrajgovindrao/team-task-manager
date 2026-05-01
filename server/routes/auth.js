const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { validateEmail, validatePassword, validateRequired, validateAccountType } = require('../utils/validators');
const { generateOTP, sendOTP } = require('../utils/mailer');

const router = express.Router();

// ─── SIGNUP ─────────────────────────────────────────────────────────────────
// Account is NOT created until OTP is verified. Data is stored in signup_otps.
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, account_type } = req.body;

    const reqErr = validateRequired(['name', 'email', 'password', 'account_type'], req.body);
    if (reqErr) return res.status(400).json({ error: reqErr });

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    const pwErr = validatePassword(password);
    if (pwErr) return res.status(400).json({ error: pwErr });

    const typeErr = validateAccountType(account_type);
    if (typeErr) return res.status(400).json({ error: typeErr });

    const cleanEmail = email.toLowerCase().trim();

    // Check if a verified user already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    // Upsert into signup_otps (replace any previous pending signup)
    await pool.query('DELETE FROM signup_otps WHERE email = $1', [cleanEmail]);
    await pool.query(
      `INSERT INTO signup_otps (name, email, password_hash, account_type, otp_code, otp_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [name.trim(), cleanEmail, passwordHash, account_type, otp, otpExpires]
    );

    // Send OTP email
    await sendOTP(cleanEmail, otp);

    res.status(201).json({
      message: 'Please check your email for the verification code.',
      requiresVerification: true,
      email: cleanEmail,
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── VERIFY OTP (Signup) ────────────────────────────────────────────────────
// Only NOW is the user account actually created in the users table.
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    const reqErr = validateRequired(['email', 'otp'], req.body);
    if (reqErr) return res.status(400).json({ error: reqErr });

    const cleanEmail = email.toLowerCase().trim();

    const result = await pool.query(
      'SELECT * FROM signup_otps WHERE email = $1',
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No pending signup found. Please sign up again.' });
    }

    const pending = result.rows[0];

    if (pending.otp_code !== otp.trim()) {
      return res.status(400).json({ error: 'Invalid OTP code.' });
    }

    if (new Date() > new Date(pending.otp_expires_at)) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    // Create the actual user account
    const userResult = await pool.query(
      `INSERT INTO users (name, email, password_hash, account_type, is_verified)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, name, email, account_type`,
      [pending.name, pending.email, pending.password_hash, pending.account_type]
    );

    // Delete the pending signup
    await pool.query('DELETE FROM signup_otps WHERE email = $1', [cleanEmail]);

    const user = userResult.rows[0];

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

// ─── RESEND OTP (Signup) ────────────────────────────────────────────────────
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;

    const reqErr = validateRequired(['email'], req.body);
    if (reqErr) return res.status(400).json({ error: reqErr });

    const cleanEmail = email.toLowerCase().trim();

    const result = await pool.query(
      'SELECT id FROM signup_otps WHERE email = $1',
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No pending signup found. Please sign up again.' });
    }

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      'UPDATE signup_otps SET otp_code = $1, otp_expires_at = $2 WHERE email = $3',
      [otp, otpExpires, cleanEmail]
    );

    await sendOTP(cleanEmail, otp);

    res.json({ message: 'A new OTP has been sent to your email.' });
  } catch (err) {
    console.error('Resend OTP error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── LOGIN ──────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const reqErr = validateRequired(['email', 'password'], req.body);
    if (reqErr) return res.status(400).json({ error: reqErr });

    const result = await pool.query(
      'SELECT id, name, email, password_hash, account_type FROM users WHERE email = $1',
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

// ─── FORGOT PASSWORD ────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const reqErr = validateRequired(['email'], req.body);
    if (reqErr) return res.status(400).json({ error: reqErr });

    const cleanEmail = email.toLowerCase().trim();

    const result = await pool.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (result.rows.length === 0) {
      // Don't reveal that email doesn't exist
      return res.json({ message: 'If an account exists with this email, an OTP has been sent.' });
    }

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      'UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE email = $3',
      [otp, otpExpires, cleanEmail]
    );

    await sendOTP(cleanEmail, otp);

    res.json({ message: 'If an account exists with this email, an OTP has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── RESET PASSWORD (with OTP) ─────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const reqErr = validateRequired(['email', 'otp', 'newPassword'], req.body);
    if (reqErr) return res.status(400).json({ error: reqErr });

    const pwErr = validatePassword(newPassword);
    if (pwErr) return res.status(400).json({ error: pwErr });

    const cleanEmail = email.toLowerCase().trim();

    const result = await pool.query(
      'SELECT id, otp_code, otp_expires_at FROM users WHERE email = $1',
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid request.' });
    }

    const user = result.rows[0];

    if (!user.otp_code || user.otp_code !== otp.trim()) {
      return res.status(400).json({ error: 'Invalid OTP code.' });
    }

    if (new Date() > new Date(user.otp_expires_at)) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await pool.query(
      'UPDATE users SET password_hash = $1, otp_code = NULL, otp_expires_at = NULL WHERE id = $2',
      [passwordHash, user.id]
    );

    res.json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── GET ME ─────────────────────────────────────────────────────────────────
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

// ─── CHANGE PASSWORD (Authenticated) ───────────────────────────────────────
router.put('/password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const reqErr = validateRequired(['currentPassword', 'newPassword'], req.body);
    if (reqErr) return res.status(400).json({ error: reqErr });

    const pwErr = validatePassword(newPassword);
    if (pwErr) return res.status(400).json({ error: pwErr });

    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, req.user.id]);

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── UPDATE PROFILE (Authenticated) ────────────────────────────────────────
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { name } = req.body;

    const reqErr = validateRequired(['name'], req.body);
    if (reqErr) return res.status(400).json({ error: reqErr });

    const result = await pool.query(
      'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email, account_type, created_at',
      [name.trim(), req.user.id]
    );

    res.json({ message: 'Profile updated.', user: result.rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
