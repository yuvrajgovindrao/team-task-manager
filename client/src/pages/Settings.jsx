import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { put, post } from '../utils/api';

export default function Settings() {
  const { user, login } = useAuth();
  const token = localStorage.getItem('token');

  // Profile
  const [name, setName] = useState(user?.name || '');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  // Change Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passMsg, setPassMsg] = useState('');
  const [passErr, setPassErr] = useState('');
  const [passLoading, setPassLoading] = useState(false);

  // Forgot / Reset Password
  const [resetStep, setResetStep] = useState('idle'); // idle | sent | resetting
  const [resetMsg, setResetMsg] = useState('');
  const [resetErr, setResetErr] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPw, setResetNewPw] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const passwordStrength = (pw) => {
    if (!pw) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[a-zA-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[!@#$%^&*(),.?":{}|<>\-_=+\[\]\\\/~`]/.test(pw)) score++;
    const levels = [
      { score: 0, label: '', color: '' },
      { score: 1, label: 'Weak', color: 'var(--danger)' },
      { score: 2, label: 'Fair', color: 'var(--warning)' },
      { score: 3, label: 'Good', color: 'var(--accent)' },
      { score: 4, label: 'Strong', color: 'var(--success)' },
    ];
    return levels[score];
  };

  const newPwStrength = passwordStrength(newPassword);
  const resetPwStrength = passwordStrength(resetNewPw);

  async function handleProfileSave(e) {
    e.preventDefault();
    setProfileMsg('');
    setProfileErr('');
    setProfileLoading(true);
    try {
      const data = await put('/auth/profile', { name });
      setProfileMsg('Profile updated successfully!');
      login(token, data.user);
    } catch (err) {
      setProfileErr(err.message);
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    setPassMsg('');
    setPassErr('');
    if (newPassword !== confirmPassword) {
      setPassErr('New passwords do not match.');
      return;
    }
    setPassLoading(true);
    try {
      await put('/auth/password', { currentPassword, newPassword });
      setPassMsg('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPassErr(err.message);
    } finally {
      setPassLoading(false);
    }
  }

  async function handleSendResetOtp() {
    setResetErr('');
    setResetMsg('');
    setResetLoading(true);
    try {
      await post('/auth/forgot-password', { email: user.email });
      setResetStep('sent');
      setResetMsg('OTP has been sent to your email.');
    } catch (err) {
      setResetErr(err.message);
    } finally {
      setResetLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setResetErr('');
    setResetMsg('');
    setResetLoading(true);
    try {
      await post('/auth/reset-password', { email: user.email, otp: resetOtp, newPassword: resetNewPw });
      setResetMsg('Password reset successfully!');
      setResetStep('idle');
      setResetOtp('');
      setResetNewPw('');
    } catch (err) {
      setResetErr(err.message);
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>⚙️ Account Settings</h1>
        <p>Manage your profile and security</p>
      </div>

      <div className="settings-grid">
        {/* Profile Section */}
        <div className="card">
          <div className="card-header">
            <h2>👤 Profile</h2>
          </div>
          <div className="card-body">
            {profileMsg && <div className="alert alert-success">{profileMsg}</div>}
            {profileErr && <div className="alert alert-error">{profileErr}</div>}

            <form onSubmit={handleProfileSave}>
              <div className="form-group">
                <label>Email</label>
                <input type="email" className="form-input" value={user?.email || ''} disabled
                  style={{ opacity: 0.6 }} />
              </div>
              <div className="form-group">
                <label htmlFor="settings-name">Full Name</label>
                <input id="settings-name" type="text" className="form-input" value={name}
                  onChange={e => setName(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-primary" disabled={profileLoading}>
                {profileLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>

        {/* Change Password Section */}
        <div className="card">
          <div className="card-header">
            <h2>🔒 Change Password</h2>
          </div>
          <div className="card-body">
            {passMsg && <div className="alert alert-success">{passMsg}</div>}
            {passErr && <div className="alert alert-error">{passErr}</div>}

            <form onSubmit={handlePasswordChange}>
              <div className="form-group">
                <label htmlFor="current-pw">Current Password</label>
                <input id="current-pw" type="password" className="form-input"
                  value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
              </div>
              <div className="form-group">
                <label htmlFor="new-pw">New Password</label>
                <input id="new-pw" type="password" className="form-input"
                  placeholder="Min 8 chars, letter + number + symbol"
                  value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} />
                {newPassword && (
                  <>
                    <div className="password-strength">
                      <div className="strength-bar">
                        <div className="strength-fill" style={{ width: `${(newPwStrength.score / 4) * 100}%`, background: newPwStrength.color }} />
                      </div>
                      <span className="strength-label" style={{ color: newPwStrength.color }}>{newPwStrength.label}</span>
                    </div>
                    <div className="password-rules">
                      <span className={newPassword.length >= 8 ? 'rule-pass' : 'rule-fail'}>✓ 8+ characters</span>
                      <span className={/[a-zA-Z]/.test(newPassword) ? 'rule-pass' : 'rule-fail'}>✓ Letter</span>
                      <span className={/[0-9]/.test(newPassword) ? 'rule-pass' : 'rule-fail'}>✓ Number</span>
                      <span className={/[!@#$%^&*(),.?":{}|<>\-_=+\[\]\\\/~`]/.test(newPassword) ? 'rule-pass' : 'rule-fail'}>✓ Symbol</span>
                    </div>
                  </>
                )}
              </div>
              <div className="form-group">
                <label htmlFor="confirm-pw">Confirm New Password</label>
                <input id="confirm-pw" type="password" className="form-input"
                  value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-primary" disabled={passLoading}>
                {passLoading ? 'Updating...' : 'Change Password'}
              </button>
            </form>
          </div>
        </div>

        {/* Forgot Password / Reset via Email */}
        <div className="card">
          <div className="card-header">
            <h2>📧 Reset Password via Email</h2>
          </div>
          <div className="card-body">
            <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 14 }}>
              Forgot your current password? We'll send an OTP to <strong>{user?.email}</strong> to verify your identity and set a new one.
            </p>

            {resetMsg && <div className="alert alert-success">{resetMsg}</div>}
            {resetErr && <div className="alert alert-error">{resetErr}</div>}

            {resetStep === 'idle' && (
              <button className="btn btn-secondary" onClick={handleSendResetOtp} disabled={resetLoading}>
                {resetLoading ? 'Sending OTP...' : 'Send OTP to Email'}
              </button>
            )}

            {resetStep === 'sent' && (
              <form onSubmit={handleResetPassword}>
                <div className="form-group">
                  <label htmlFor="reset-otp">OTP Code</label>
                  <input id="reset-otp" type="text" className="form-input" placeholder="Enter 6-digit code"
                    value={resetOtp} onChange={e => setResetOtp(e.target.value)} required maxLength={6} />
                </div>
                <div className="form-group">
                  <label htmlFor="reset-new-pw">New Password</label>
                  <input id="reset-new-pw" type="password" className="form-input"
                    placeholder="Min 8 chars, letter + number + symbol"
                    value={resetNewPw} onChange={e => setResetNewPw(e.target.value)} required minLength={8} />
                  {resetNewPw && (
                    <div className="password-strength">
                      <div className="strength-bar">
                        <div className="strength-fill" style={{ width: `${(resetPwStrength.score / 4) * 100}%`, background: resetPwStrength.color }} />
                      </div>
                      <span className="strength-label" style={{ color: resetPwStrength.color }}>{resetPwStrength.label}</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => { setResetStep('idle'); setResetOtp(''); setResetNewPw(''); setResetErr(''); setResetMsg(''); }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={resetLoading}>
                    {resetLoading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
