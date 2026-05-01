import { useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { post } from '../utils/api';

export default function ResetPassword() {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef([]);
  const navigate = useNavigate();
  const location = useLocation();

  const email = location.state?.email || '';

  function handleOtpChange(index, value) {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').split('').slice(0, 6);
      const newOtpArr = [...otp];
      digits.forEach((d, i) => { if (index + i < 6) newOtpArr[index + i] = d; });
      setOtp(newOtpArr);
      inputRefs.current[Math.min(index + digits.length, 5)]?.focus();
      return;
    }
    if (value && !/^\d$/.test(value)) return;
    const newOtpArr = [...otp];
    newOtpArr[index] = value;
    setOtp(newOtpArr);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  const passwordStrength = (() => {
    if (!newPassword) return { score: 0, label: '', color: '' };
    let score = 0;
    if (newPassword.length >= 8) score++;
    if (/[a-zA-Z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[!@#$%^&*(),.?":{}|<>\-_=+\[\]\\\/~`]/.test(newPassword)) score++;
    const levels = [
      { score: 0, label: '', color: '' },
      { score: 1, label: 'Weak', color: 'var(--danger)' },
      { score: 2, label: 'Fair', color: 'var(--warning)' },
      { score: 3, label: 'Good', color: 'var(--accent)' },
      { score: 4, label: 'Strong', color: 'var(--success)' },
    ];
    return levels[score];
  })();

  async function handleSubmit(e) {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code.');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await post('/auth/reset-password', { email, otp: code, newPassword });
      setSuccess('Password reset successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!email) {
    return (
      <div className="auth-page">
        <div className="auth-card slide-up">
          <div className="auth-brand">
            <div className="logo">T</div>
            <h1>Reset Password</h1>
            <p>Please start from the forgot password page</p>
          </div>
          <div className="auth-footer">
            <Link to="/forgot-password">Go to Forgot Password</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card slide-up" style={{ maxWidth: '460px' }}>
        <div className="auth-brand">
          <div className="logo">T</div>
          <h1>Reset password</h1>
          <p>Enter the code sent to</p>
          <p style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '15px', marginTop: '4px' }}>{email}</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="otp-container" style={{ marginBottom: '20px' }}>
            {otp.map((digit, i) => (
              <input key={i} ref={el => (inputRefs.current[i] = el)}
                type="text" inputMode="numeric" maxLength={6}
                className={`otp-input ${digit ? 'filled' : ''}`} value={digit}
                onChange={e => handleOtpChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                onFocus={e => e.target.select()} />
            ))}
          </div>

          <div className="form-group">
            <label htmlFor="new-password">New Password</label>
            <input id="new-password" type="password" className="form-input"
              placeholder="Min 8 chars, letter + number + symbol"
              value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} />
            {newPassword && (
              <div className="password-strength">
                <div className="strength-bar">
                  <div className="strength-fill" style={{ width: `${(passwordStrength.score / 4) * 100}%`, background: passwordStrength.color }} />
                </div>
                <span className="strength-label" style={{ color: passwordStrength.color }}>{passwordStrength.label}</span>
              </div>
            )}
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading || !!success}>
            {loading ? 'Resetting...' : success ? '✓ Done!' : 'Reset Password'}
          </button>
        </form>

        <div className="auth-footer">
          <Link to="/login">Back to login</Link>
        </div>
      </div>
    </div>
  );
}
