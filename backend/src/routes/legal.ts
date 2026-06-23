import { Router, Request, Response } from 'express';

const router = Router();
const page = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>body{font-family:-apple-system,system-ui,sans-serif;max-width:680px;margin:40px auto;padding:0 20px;line-height:1.6;color:#111}h1{font-size:1.5rem}h2{font-size:1.1rem;margin-top:1.5rem}</style></head><body>${body}</body></html>`;

router.get('/privacy', (_req: Request, res: Response) => {
  res.type('html').send(page('PodChat Privacy Policy', `
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
  `));
});

router.get('/terms', (_req: Request, res: Response) => {
  res.type('html').send(page('PodChat Terms of Use', `
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
  `));
});

export default router;
