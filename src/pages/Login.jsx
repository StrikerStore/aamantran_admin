import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { saveToken, isAuthenticated } from '../lib/auth';
import { useToast } from '../components/ui/Toast';

/** Only allow internal paths as post-login redirect targets (no open redirect). */
function safeNext(raw) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/dashboard';
  return raw;
}

const IconEye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const IconEyeOff = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export default function Login() {
  const navigate  = useNavigate();
  const toast     = useToast();
  const [searchParams] = useSearchParams();
  const nextPath  = safeNext(searchParams.get('next'));

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [otp,      setOtp]      = useState('');
  const [otpRequired, setOtpRequired] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    if (isAuthenticated()) navigate(nextPath, { replace: true });
  }, [navigate, nextPath]);

  function handleCapsLock(e) {
    if (typeof e.getModifierState === 'function') {
      setCapsLock(e.getModifierState('CapsLock'));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.auth.login(email, password, otpRequired ? otp : undefined);
      saveToken(res.token);
      navigate(nextPath, { replace: true });
    } catch (err) {
      if (err.body?.code === 'OTP_REQUIRED') {
        setOtpRequired(true);
        setOtp('');
      } else {
        const msg = err.message || 'Login failed';
        setError(msg);
        toast(msg, 'error');
        if (err.body?.code === 'OTP_INVALID') setOtp('');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 380,
        padding: '0 20px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <img
            src="/logo-180.png"
            alt=""
            width={56}
            height={56}
            decoding="async"
            fetchPriority="high"
            style={{ display: 'block', margin: '0 auto 12px', objectFit: 'contain' }}
          />
          <div style={{
            fontFamily: "'Baloo 2', 'Nunito', sans-serif",
            fontSize: '1.8rem',
            fontWeight: 600,
            color: 'var(--gold)',
            letterSpacing: '0.02em',
          }}>Aamantran</div>
          <div style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginTop: 4,
          }}>Admin Panel</div>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--r-lg)',
          padding: '32px',
        }}>
          <h1 style={{
            fontSize: '1.1rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 24,
          }}>{otpRequired ? 'Two-factor verification' : 'Sign in'}</h1>

          <form onSubmit={handleSubmit}>
            {!otpRequired && (
              <>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="Email address"
                    value={email}
                    onChange={e => { setEmail(e.target.value); if (error) setError(''); }}
                    autoComplete="username"
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group" style={{ marginBottom: error || capsLock ? 16 : 28 }}>
                  <label className="form-label">Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => { setPassword(e.target.value); if (error) setError(''); }}
                      onKeyDown={handleCapsLock}
                      onKeyUp={handleCapsLock}
                      onBlur={() => setCapsLock(false)}
                      autoComplete="current-password"
                      required
                      style={{ paddingRight: 40, width: '100%' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        right: 10,
                        transform: 'translateY(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        padding: 4,
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {showPassword ? <IconEyeOff /> : <IconEye />}
                    </button>
                  </div>
                  {capsLock && (
                    <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--red)' }}>
                      ⇪ Caps Lock is on
                    </div>
                  )}
                </div>
              </>
            )}

            {otpRequired && (
              <div className="form-group" style={{ marginBottom: error ? 16 : 28 }}>
                <label className="form-label">Authenticator code</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="6-digit code"
                  value={otp}
                  onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); if (error) setError(''); }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoComplete="one-time-code"
                  style={{ letterSpacing: 6, fontVariantNumeric: 'tabular-nums' }}
                  required
                  autoFocus
                />
                <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Enter the code from your authenticator app.
                </div>
              </div>
            )}

            {error && (
              <div style={{
                marginBottom: 20,
                padding: '10px 14px',
                borderRadius: 'var(--r-sm)',
                background: 'var(--rose-soft)',
                border: '1px solid var(--rose)',
                color: 'var(--red)',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{ fontSize: '1rem', lineHeight: 1 }}>&#9888;</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={loading}
            >
              {loading ? <span className="btn-spinner" /> : otpRequired ? 'Verify' : 'Sign in'}
            </button>

            {otpRequired && (
              <button
                type="button"
                onClick={() => { setOtpRequired(false); setOtp(''); setError(''); }}
                style={{
                  width: '100%',
                  marginTop: 12,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                ← Back to sign in
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
