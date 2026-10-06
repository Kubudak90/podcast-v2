const USERNAME_RE = /^[a-zA-Z0-9_]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SignupFields {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeTerms: boolean;
}

export interface SignupValues {
  username: string;
  email: string;
  password: string;
}

export type SignupError =
  | 'username_required'
  | 'username_short'
  | 'username_long'
  | 'username_chars'
  | 'email_required'
  | 'email_invalid'
  | 'password_required'
  | 'password_short'
  | 'password_mismatch'
  | 'terms_required';

export const signupErrorMessage: Record<SignupError, string> = {
  username_required: 'Kullanici adi gerekli',
  username_short: 'Kullanici adi en az 2 karakter olmali',
  username_long: 'Kullanici adi en fazla 50 karakter olabilir',
  username_chars: 'Kullanici adi yalnizca harf, rakam ve alt cizgi icerebilir',
  email_required: 'Email gerekli',
  email_invalid: 'Gecerli bir email girin',
  password_required: 'Sifre gerekli',
  password_short: 'Sifre en az 6 karakter olmali',
  password_mismatch: 'Sifreler eslesmiyor',
  terms_required: 'Kullanim sartlarini kabul etmelisiniz',
};

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '');
}

export function validateSignup(fields: SignupFields): SignupError | null {
  const username = normalizeUsername(fields.username);
  const email = fields.email.trim();

  if (!username) return 'username_required';
  if (username.length < 2) return 'username_short';
  if (username.length > 50) return 'username_long';
  if (!USERNAME_RE.test(username)) return 'username_chars';

  if (!email) return 'email_required';
  if (!EMAIL_RE.test(email)) return 'email_invalid';

  if (!fields.password) return 'password_required';
  if (fields.password.length < 6) return 'password_short';
  if (fields.password !== fields.confirmPassword) return 'password_mismatch';
  if (!fields.agreeTerms) return 'terms_required';

  return null;
}

export function signupPayload(fields: SignupFields): SignupValues | null {
  if (validateSignup(fields)) return null;
  return {
    username: normalizeUsername(fields.username),
    email: fields.email.trim(),
    password: fields.password,
  };
}

export function legalPageUrl(
  page: 'terms' | 'privacy',
  apiBase: string = import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
): string {
  const base = String(apiBase).replace(/\/$/, '');
  return `${base}/legal/${page}`;
}
