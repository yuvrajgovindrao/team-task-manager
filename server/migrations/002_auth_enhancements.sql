-- 002_auth_enhancements.sql — Add OTP verification, account types, strong passwords

ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type   VARCHAR(20) DEFAULT 'member';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified    BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code       VARCHAR(6);
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ;

-- Mark all existing users as verified so they aren't locked out
UPDATE users SET is_verified = true WHERE is_verified IS NOT TRUE;
