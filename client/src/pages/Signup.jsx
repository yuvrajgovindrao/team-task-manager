import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { post } from '../utils/api';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState('member');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Password strength calculation
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '' };
    let score = 0;
    if (password.length >= 8) score++;
    if (/[a-zA-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[!@#$%^&*(),.?":{}|<>\-_=+\[\]\\\/~`]/.test(password)) score++;

    const levels = [
      { score: 0, label: '', color: '' },
      { score: 1, label: 'Weak', color: 'var(--danger)' },
      { score: 2, label: 'Fair', color: 'var(--warning)' },
      { score: 3, label: 'Good', color: 'var(--accent)' },
      { score: 4, label: 'Strong', color: 'var(--success)' },
    ];

    return levels[score];
  }, [password]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await post('/auth/signup', { name, email, password, account_type: accountType });
      // Redirect to OTP verification
      navigate('/verify-otp', {
        state: { email: data.email },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card slide-up" style={{ maxWidth: '460px' }}>
        <div className="auth-brand">
          <div className="logo">T</div>
          <h1>Create account</h1>
          <p>Get started with TeamFlow today</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="signup-name">Full Name</label>
            <input id="signup-name" type="text" className="form-input" placeholder="John Doe"
              value={name} onChange={e => setName(e.target.value)} required />
          </div>

          <div className="form-group">
            <label htmlFor="signup-email">Email</label>
            <input id="signup-email" type="email" className="form-input" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div className="form-group">
            <label htmlFor="signup-password">Password</label>
            <input id="signup-password" type="password" className="form-input" placeholder="Min 8 chars, letter + number + symbol"
              value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
            {password && (
              <div className="password-strength">
                <div className="strength-bar">
                  <div
                    className="strength-fill"
                    style={{
                      width: `${(passwordStrength.score / 4) * 100}%`,
                      background: passwordStrength.color,
                    }}
                  />
                </div>
                <span className="strength-label" style={{ color: passwordStrength.color }}>
                  {passwordStrength.label}
                </span>
              </div>
            )}
            <div className="password-rules">
              <span className={password.length >= 8 ? 'rule-pass' : 'rule-fail'}>✓ 8+ characters</span>
              <span className={/[a-zA-Z]/.test(password) ? 'rule-pass' : 'rule-fail'}>✓ Letter</span>
              <span className={/[0-9]/.test(password) ? 'rule-pass' : 'rule-fail'}>✓ Number</span>
              <span className={/[!@#$%^&*(),.?":{}|<>\-_=+\[\]\\\/~`]/.test(password) ? 'rule-pass' : 'rule-fail'}>✓ Symbol</span>
            </div>
          </div>

          <div className="form-group">
            <label>Account Type</label>
            <div className="account-type-grid">
              <label className={`account-type-card ${accountType === 'admin' ? 'selected' : ''}`}>
                <input type="radio" name="accountType" value="admin"
                  checked={accountType === 'admin'} onChange={() => setAccountType('admin')} />
                <div className="account-type-icon">🛡️</div>
                <div className="account-type-name">Admin</div>
                <div className="account-type-desc">Create projects, manage teams & assign tasks</div>
              </label>
              <label className={`account-type-card ${accountType === 'member' ? 'selected' : ''}`}>
                <input type="radio" name="accountType" value="member"
                  checked={accountType === 'member'} onChange={() => setAccountType('member')} />
                <div className="account-type-icon">👤</div>
                <div className="account-type-name">Member</div>
                <div className="account-type-desc">View projects, update task status & collaborate</div>
              </label>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
