import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { post } from '../utils/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setNeedsVerification(false);
    setLoading(true);
    try {
      const data = await post('/auth/login', { email, password });
      login(data.token, data.user);
      navigate('/');
    } catch (err) {
      if (err.requiresVerification) {
        setNeedsVerification(true);
        setError('Your email is not verified yet.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  function goToVerify() {
    navigate('/verify-otp', { state: { email } });
  }

  return (
    <div className="auth-page">
      <div className="auth-card slide-up">
        <div className="auth-brand">
          <div className="logo">T</div>
          <h1>Welcome back</h1>
          <p>Sign in to your TeamFlow account</p>
        </div>

        {error && (
          <div className="alert alert-error">
            {error}
            {needsVerification && (
              <button className="btn-link" onClick={goToVerify} style={{ marginLeft: '8px', color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline' }}>
                Verify now →
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="login-email">Email</label>
            <input id="login-email" type="email" className="form-input" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input id="login-password" type="password" className="form-input" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </div>
      </div>
    </div>
  );
}
