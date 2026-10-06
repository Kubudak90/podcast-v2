import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/UI';
import { api } from '../lib/api';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [devResetUrl, setDevResetUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email gerekli');
      return;
    }

    setIsLoading(true);
    setError('');
    setNotice('');
    setDevResetUrl('');

    try {
      const response = await api.forgotPassword(email.trim());
      setNotice(response.message);
      if (response.devResetUrl) {
        setDevResetUrl(response.devResetUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sifre sifirlama istegi gonderilemedi');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-pod-bg flex flex-col safe-area-pt">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Reset password</h1>
          <p className="text-pod-text-secondary text-sm max-w-sm">
            Enter the email on your account. If we can send mail, the link expires in 30 minutes.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
          <div className="space-y-2">
            <label htmlFor="reset-email" className="text-[10px] font-semibold tracking-widest text-pod-text-secondary uppercase">
              Email
            </label>
            <input
              id="reset-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              autoComplete="email"
              className="input"
              autoFocus
            />
          </div>

          {notice && (
            <p className="text-sm text-white" role="status">
              {notice}
            </p>
          )}
          {devResetUrl && (
            <a href={devResetUrl} className="block text-pod-red text-sm font-medium break-all">
              Open reset link
            </a>
          )}
          {error && <p className="text-pod-red text-sm">{error}</p>}

          <Button type="submit" className="w-full h-14 text-sm tracking-wider" isLoading={isLoading}>
            SEND RESET LINK
          </Button>
        </form>

        <Link to="/login" className="text-pod-text-secondary text-sm min-h-11 inline-flex items-center">
          Back to login
        </Link>
      </div>
    </div>
  );
}
