import { Router, type Request, type Response } from 'express';

const router = Router();

// Helmet turns CSP off for the JSON API. These two routes are the exception:
// they send HTML, so the response sets its own policy.
const LEGAL_CSP = [
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  "img-src 'none'",
  "script-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const PAGE_STYLE = [
  'html{color-scheme:dark;background:#0c0c0c}',
  'body{font-family:-apple-system,system-ui,sans-serif;max-width:680px;margin:0 auto;padding:max(24px,env(safe-area-inset-top)) 20px max(32px,env(safe-area-inset-bottom));line-height:1.6;background:#0c0c0c;color:#f4f4f5;font-size:16px}',
  'h1{font-size:1.5rem}',
  'h2{font-size:1.1rem;margin-top:1.5rem}',
  'a{color:#fda4af}',
].join('');

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// `body` is the route's own markup. Only the title is interpolated text.
export function renderLegalPage(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>${escapeHtml(title)}</title><style>${PAGE_STYLE}</style></head><body>${body}</body></html>`;
}

function sendLegal(res: Response, title: string, body: string) {
  res
    .set('Content-Security-Policy', LEGAL_CSP)
    .set('X-Frame-Options', 'DENY')
    .set('Referrer-Policy', 'no-referrer')
    .type('html')
    .send(renderLegalPage(title, body));
}

router.get('/privacy', (_req: Request, res: Response) => {
  sendLegal(
    res,
    'PodChat Privacy Policy',
    `
    <h1>PodChat Privacy Policy</h1>
    <p>Last updated: 23 June 2026. This policy explains what PodChat ("we") collects and how we use it.</p>
    <h2>Data we collect</h2>
    <ul>
      <li><b>Account info</b> — your email and username (via email, Google, or Apple sign-in). With Sign in with Apple you may use a private-relay email.</li>
      <li><b>Content you create</b> — live room audio, recordings, uploaded audio, cover images, profile info, and chat messages.</li>
      <li><b>Usage</b> — basic interaction and diagnostic data needed to run the service.</li>
    </ul>
    <h2>Third parties</h2>
    <p>We use <b>LiveKit</b> to transmit real-time audio and <b>Google</b> for optional sign-in. Audio recordings are stored on our servers.</p>
    <h2>Retention &amp; deletion</h2>
    <p>You can delete your account and associated data at any time from the app (Profile &rarr; Delete Account), which permanently removes your account, recordings, uploads, and related data. To request help, contact us below.</p>
    <h2>Contact</h2>
    <p>Email: <a href="mailto:support@livepodchat.com">support@livepodchat.com</a></p>
  `,
  );
});

router.get('/terms', (_req: Request, res: Response) => {
  sendLegal(
    res,
    'PodChat Terms of Use',
    `
    <h1>PodChat Terms of Use (EULA)</h1>
    <p>Last updated: 23 June 2026. By using PodChat you agree to these terms.</p>
    <h2>Acceptable use — zero tolerance</h2>
    <p>There is <b>no tolerance for objectionable content or abusive behavior</b>. You agree not to post, stream, upload, or share content that is harassing, hateful, sexually explicit, illegal, or otherwise objectionable, and not to abuse other users.</p>
    <h2>Moderation</h2>
    <p>You can report content and block users in the app. We review reports and may remove content and suspend or terminate accounts that violate these terms, typically within 24 hours of a report.</p>
    <h2>Your content</h2>
    <p>You are responsible for the content you create and retain ownership of it; you grant us the rights needed to operate the service (e.g. to store and transmit your audio).</p>
    <h2>Termination</h2>
    <p>You may delete your account at any time in the app. We may suspend accounts that violate these terms.</p>
    <h2>Contact</h2>
    <p>Email: <a href="mailto:support@livepodchat.com">support@livepodchat.com</a></p>
  `,
  );
});

export default router;
