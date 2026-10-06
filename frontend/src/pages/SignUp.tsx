import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/UI';
import { api } from '../lib/api';
import { legalPageUrl, signupErrorMessage, signupPayload, validateSignup } from '../lib/signup';
import { useAuthStore } from '../lib/store';

export function SignUp() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fields = { username, email, password, confirmPassword, agreeTerms };
    const validationError = validateSignup(fields);
    if (validationError) {
      setError(signupErrorMessage[validationError]);
      return;
    }
    const payload = signupPayload(fields);
    if (!payload) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await api.register(payload.username, payload.email, payload.password);
      api.setToken(response.token);
      setAuth(response.user, response.token);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hesap olusturulamadi');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsupportedSocial = (provider: 'Google' | 'Apple') => {
    setError(`${provider} ile kayit su an yalnizca iOS uygulamasinda aktif.`);
  };

  return (
    <div className="min-h-screen bg-pod-bg flex flex-col safe-area-pt">
      <div className="flex-1 px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center border border-pod-border rounded-lg hover:bg-pod-elevated transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">CREATE ACCOUNT</h1>
            <p className="text-pod-text-secondary text-sm font-mono">Join the conversation</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-5 max-w-sm">
          <div className="space-y-2">
            <label htmlFor="signup-username" className="text-[10px] font-semibold tracking-widest text-pod-text-secondary uppercase">
              Username
            </label>
            <input
              id="signup-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@username"
              className="input"
              autoFocus
              autoComplete="username"
              maxLength={51}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="signup-email" className="text-[10px] font-semibold tracking-widest text-pod-text-secondary uppercase">
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="input"
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="signup-password" className="text-[10px] font-semibold tracking-widest text-pod-text-secondary uppercase">
              Password
            </label>
            <div className="relative">
              <input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input pr-12"
                autoComplete="new-password"
                aria-describedby="signup-password-hint"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Sifreyi gizle' : 'Sifreyi goster'}
                className="absolute right-1 top-1/2 -translate-y-1/2 min-w-11 min-h-11 flex items-center justify-center text-pod-text-secondary hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>
            <p id="signup-password-hint" className="text-xs text-pod-text-secondary">
              En az 6 karakter
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="signup-confirm" className="text-[10px] font-semibold tracking-widest text-pod-text-secondary uppercase">
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="signup-confirm"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="input pr-12"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Sifre tekrarini gizle' : 'Sifre tekrarini goster'}
                className="absolute right-1 top-1/2 -translate-y-1/2 min-w-11 min-h-11 flex items-center justify-center text-pod-text-secondary hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Terms */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setAgreeTerms(!agreeTerms)}
              aria-pressed={agreeTerms}
              aria-label="Kullanim sartlarini kabul et"
              className="w-11 h-11 flex-shrink-0 flex items-center justify-center"
            >
              <span className={`w-4 h-4 rounded-sm flex items-center justify-center transition-colors ${agreeTerms ? 'bg-pod-red' : 'border border-pod-border'}`}>
                {agreeTerms && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
            </button>
            <span className="text-xs text-pod-text-secondary leading-relaxed">
              I agree to the{' '}
              <a
                href={legalPageUrl('terms')}
                target="_blank"
                rel="noopener noreferrer"
                className="text-pod-red underline"
              >
                Terms
              </a>
              {' '}and{' '}
              <a
                href={legalPageUrl('privacy')}
                target="_blank"
                rel="noopener noreferrer"
                className="text-pod-red underline"
              >
                Privacy Policy
              </a>
            </span>
          </div>

          {error && <p className="text-pod-red text-sm">{error}</p>}

          <Button type="submit" className="w-full h-14 text-sm tracking-wider" isLoading={isLoading}>
            CREATE ACCOUNT
          </Button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-4 my-8 max-w-sm">
          <div className="flex-1 h-px bg-pod-border" />
          <span className="text-pod-text-secondary text-[11px] font-semibold tracking-widest">OR</span>
          <div className="flex-1 h-px bg-pod-border" />
        </div>

        {/* Social Sign Up */}
        <div className="space-y-3 max-w-sm">
          <button
            type="button"
            onClick={() => handleUnsupportedSocial('Google')}
            className="w-full h-14 flex items-center justify-center gap-3 border border-pod-border rounded-lg hover:bg-pod-elevated transition-colors"
          >
            <span className="text-lg font-bold text-white">G</span>
            <span className="text-sm font-medium text-white">SIGN UP WITH GOOGLE</span>
          </button>
          <button
            type="button"
            onClick={() => handleUnsupportedSocial('Apple')}
            className="w-full h-14 flex items-center justify-center gap-3 border border-pod-border rounded-lg hover:bg-pod-elevated transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            <span className="text-sm font-medium text-white">SIGN UP WITH APPLE</span>
          </button>
        </div>

        {/* Login Link */}
        <div className="flex items-center justify-center gap-1 mt-8">
          <span className="text-pod-text-secondary text-sm">Already have an account?</span>
          <Link to="/login" className="text-pod-red text-sm font-semibold">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
