export type IdentityFailure = 'invalid' | 'unverified';

export type IdentityRead<T> = { ok: true; profile: T } | { ok: false; reason: IdentityFailure };

export type GoogleUserInfo = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
};

export type AppleIdentity = {
  sub: string;
  email?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

/** Google and Apple both use boolean true; Apple also sends the string "true". */
export function isEmailVerifiedClaim(value: unknown): boolean {
  return value === true || value === 'true';
}

/**
 * Google userinfo is trusted for account lookup only when the address is verified.
 * An unverified address must not link or create a PodChat user.
 */
export function readGoogleUserInfo(payload: unknown): IdentityRead<GoogleUserInfo> {
  if (!isRecord(payload)) return { ok: false, reason: 'invalid' };

  const sub = nonEmptyString(payload.sub);
  const email = nonEmptyString(payload.email);
  if (!sub || !email) return { ok: false, reason: 'invalid' };
  if (!isEmailVerifiedClaim(payload.email_verified)) return { ok: false, reason: 'unverified' };

  const name = nonEmptyString(payload.name) ?? undefined;
  const picture = nonEmptyString(payload.picture) ?? undefined;
  return { ok: true, profile: { sub, email, name, picture } };
}

/**
 * Apple omits email on later sign-ins. When an email is present it has to be verified
 * before it can match an existing account.
 */
export function readAppleIdentity(payload: unknown): IdentityRead<AppleIdentity> {
  if (!isRecord(payload)) return { ok: false, reason: 'invalid' };

  const sub = nonEmptyString(payload.sub);
  if (!sub) return { ok: false, reason: 'invalid' };

  if (payload.email === undefined || payload.email === null || payload.email === '') {
    return { ok: true, profile: { sub } };
  }

  const email = nonEmptyString(payload.email);
  if (!email) return { ok: false, reason: 'invalid' };
  if (!isEmailVerifiedClaim(payload.email_verified)) return { ok: false, reason: 'unverified' };

  return { ok: true, profile: { sub, email } };
}
