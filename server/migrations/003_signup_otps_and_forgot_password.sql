-- 003_signup_otps_and_forgot_password.sql

-- Separate table for pending signups (account NOT created until OTP verified)
CREATE TABLE IF NOT EXISTS signup_otps (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  account_type  VARCHAR(20) DEFAULT 'member',
  otp_code      VARCHAR(6) NOT NULL,
  otp_expires_at TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_signup_otps_email ON signup_otps(email);

-- Clean up any unverified users from the old approach
DELETE FROM users WHERE is_verified = false;
