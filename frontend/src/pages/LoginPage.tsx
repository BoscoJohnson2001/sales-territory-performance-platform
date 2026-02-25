import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_HOME: Record<string, string> = {
  ADMIN: '/admin/dashboard', MANAGEMENT: '/management/dashboard', SALES: '/sales/dashboard',
};

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Already logged in
  if (user) { navigate(ROLE_HOME[user.role] || '/login'); return null; }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await login(identifier.trim(), password);
      const u = JSON.parse(localStorage.getItem('auth_user') || '{}');
      navigate(ROLE_HOME[u.role] || '/login');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4 animate-fade-in">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2
                        w-[600px] h-[400px] bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center
                          font-black text-black text-xl shadow-accent">
            P
          </div>
          <div>
            <p className="text-text-primary font-bold text-lg leading-tight">Pfizer Sales</p>
            <p className="text-text-muted text-xs leading-tight">Intelligence Platform</p>
          </div>
        </div>

        {/* Card */}
        <div className="card shadow-glow">
          <h2 className="text-text-primary text-xl font-bold mb-1">Sign In</h2>
          <p className="text-text-muted text-sm mb-6">Use your email or Sales ID (e.g. SL_001)</p>

          {error && (
            <div id="login-error" className="mb-4 px-4 py-3 rounded-lg bg-status-low/10 border border-status-low/30
                          text-status-low text-sm animate-slide-in">
              {error}
            </div>
          )}

          <form id="login-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="stat-card-label block mb-1.5" htmlFor="identifier">Email or User Code</label>
              <input
                id="identifier"
                className="input"
                type="text"
                placeholder="admin@pfizer.com or SL_001"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="stat-card-label block mb-1.5" htmlFor="password">Password</label>
              <input
                id="password"
                className="input"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-text-subtle text-xs mt-6">
          &copy; 2026 Pfizer Medical Industries
        </p>
      </div>
    </div>
  );
}
