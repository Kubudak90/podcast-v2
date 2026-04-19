import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/UI';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';

export function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email gerekli');
      return;
    }
    if (!password) {
      setError('Sifre gerekli');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await api.login(email.trim(), password);
      api.setToken(response.token);
      setAuth(response.user, response.token);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giris yapilamadi');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsupportedSocial = (provider: 'Google' | 'Apple') => {
    setError(`${provider} ile giris su an yalnizca iOS uygulamasinda aktif.`);
  };

  return (
    <div className="min-h-screen bg-pod-bg flex flex-col safe-area-pt">
      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-12">
        {/* Logo Section */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 bg-pod-red rounded-2xl flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
            </svg>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">PODCHAT</h1>
          <p className="text-pod-text-secondary font-mono text-sm">Live podcast with friends</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-semibold tracking-widest text-pod-text-secondary uppercase">
              Email
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="input"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-semibold tracking-widest text-pod-text-secondary uppercase">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-pod-text-secondary hover:text-white transition-colors"
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
            <div className="text-right">
              <button type="button" className="text-pod-red text-xs font-medium">
                Forgot password?
              </button>
            </div>
          </div>

          {error && <p className="text-pod-red text-sm">{error}</p>}

          <Button type="submit" className="w-full h-14 text-sm tracking-wider" isLoading={isLoading}>
            LOGIN
          </Button>
        </form>

        {/* Divider */}
        <div className="w-full max-w-sm flex items-center gap-4">
          <div className="flex-1 h-px bg-pod-border" />
          <span className="text-pod-text-secondary text-[11px] font-semibold tracking-widest">OR</span>
          <div className="flex-1 h-px bg-pod-border" />
        </div>

        {/* Social Login */}
        <div className="w-full max-w-sm space-y-3">
          <button
            type="button"
            onClick={() => handleUnsupportedSocial('Google')}
            className="w-full h-14 flex items-center justify-center gap-3 border border-pod-border rounded-lg hover:bg-pod-elevated transition-colors"
          >
            <span className="text-lg font-bold text-white">G</span>
            <span className="text-sm font-medium text-white">CONTINUE WITH GOOGLE</span>
          </button>
          <button
            type="button"
            onClick={() => handleUnsupportedSocial('Apple')}
            className="w-full h-14 flex items-center justify-center gap-3 border border-pod-border rounded-lg hover:bg-pod-elevated transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            <span className="text-sm font-medium text-white">CONTINUE WITH APPLE</span>
          </button>
        </div>

        {/* Sign Up Link */}
        <div className="flex items-center gap-1">
          <span className="text-pod-text-secondary text-sm">Don't have an account?</span>
          <Link to="/signup" className="text-pod-red text-sm font-semibold">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
