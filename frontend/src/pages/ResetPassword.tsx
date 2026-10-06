import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/UI';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';

export function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const { setAuth } = useAuthStore();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Sifre gerekli');
      return;
    }
    if (password.length < 6) {
      setError('Sifre en az 6 karakter olmali');
      return;
    }
    if (password !== confirmPassword) {
      setError('Sifreler eslesmiyor');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await api.resetPassword(token, password);
      api.setToken(response.token);
      setAuth(response.user, response.token);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sifre guncellenemedi');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-pod-bg flex flex-col items-center justify-center px-6 gap-4 text-center safe-area-pt">
        <h1 className="text-2xl font-bold text-white">Reset link missing</h1>
        <p className="text-pod-text-secondary text-sm">Request a new link and open it from your email.</p>
        <Link to="/forgot-password" className="text-pod-red text-sm font-semibold min-h-11 inline-flex items-center">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pod-bg flex flex-col safe-area-pt">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Choose a new password</h1>
          <p className="text-pod-text-secondary text-sm">At least 6 characters. You will be signed in after it saves.</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
          <div className="space-y-2">
            <label htmlFor="new-password" className="text-[10px] font-semibold tracking-widest text-pod-text-secondary uppercase">
              New password
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
                className="input pr-12"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-pod-text-secondary hover:text-white transition-colors min-w-11 min-h-11 flex items-center justify-center"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  {showPassword ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  ) : (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-password" className="text-[10px] font-semibold tracking-widest text-pod-text-secondary uppercase">
              Confirm password
            </label>
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="••••••••"
              className="input"
            />
          </div>

          {error && <p className="text-pod-red text-sm">{error}</p>}

          <Button type="submit" className="w-full h-14 text-sm tracking-wider" isLoading={isLoading}>
            UPDATE PASSWORD
          </Button>
        </form>

        <Link to="/login" className="text-pod-text-secondary text-sm min-h-11 inline-flex items-center">
          Back to login
        </Link>
      </div>
    </div>
  );
}
