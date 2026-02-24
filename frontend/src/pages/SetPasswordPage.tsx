import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import client from '../api/client';

export default function SetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => { if (!token) setError('Invalid link. No token found.'); }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true); setError('');
    try {
      await client.post('/api/auth/set-password', { token, password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(msg || 'Failed to set password. Link may be expired.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4 animate-fade-in">
      <div className="relative w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center font-black text-black text-xl shadow-accent">P</div>
          <div>
            <p className="text-text-primary font-bold text-lg leading-tight">Pfizer Sales</p>
            <p className="text-text-muted text-xs">Set Your Password</p>
          </div>
        </div>

        <div className="card">
          {success ? (
            <div className="text-center py-4">
              <div className="text-status-high text-4xl mb-3">&#10003;</div>
              <p className="text-text-primary font-semibold">Password set successfully!</p>
              <p className="text-text-muted text-sm mt-1">Redirecting to login...</p>
            </div>
          ) : (
            <>
              <h2 className="text-text-primary text-xl font-bold mb-1">Create Password</h2>
              <p className="text-text-muted text-sm mb-6">Choose a strong password for your account.</p>
              {error && (
                <div id="setpw-error" className="mb-4 px-4 py-3 rounded-lg bg-status-low/10 border border-status-low/30 text-status-low text-sm">
                  {error}
                </div>
              )}
              <form id="set-password-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="stat-card-label block mb-1.5" htmlFor="new-password">New Password</label>
                  <input id="new-password" className="input" type="password" placeholder="Min. 8 characters"
                    value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <div>
                  <label className="stat-card-label block mb-1.5" htmlFor="confirm-password">Confirm Password</label>
                  <input id="confirm-password" className="input" type="password" placeholder="Repeat password"
                    value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                </div>
                <button id="setpw-submit" type="submit" disabled={loading || !token} className="btn-primary w-full justify-center mt-2">
                  {loading ? 'Saving...' : 'Set Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
