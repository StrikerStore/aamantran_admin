import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { saveToken, isAuthenticated } from '../lib/auth';
import { useToast } from '../components/ui/Toast';

export default function Login() {
  const navigate  = useNavigate();
  const toast     = useToast();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (isAuthenticated()) navigate('/dashboard', { replace: true });
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.auth.login(email, password);
      saveToken(res.token);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast(err.message || 'Login failed', 'error');
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
            src="/logo.png"
            alt=""
            width={56}
            height={56}
            decoding="async"
            style={{ display: 'block', margin: '0 auto 12px', objectFit: 'contain' }}
          />
          <div style={{
            fontFamily: "'Playfair Display', serif",
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
          }}>Sign in</h1>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="aamantran@plexzuu.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group" style={{ marginBottom: 28 }}>
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={loading}
            >
              {loading ? <span className="btn-spinner" /> : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
