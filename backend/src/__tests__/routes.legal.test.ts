import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { renderLegalPage } from '../routes/legal.js';

describe('Legal Routes', () => {
  const app = createApp();

  it('GET /api/legal/privacy -> 200 text/html containing the policy', async () => {
    const res = await request(app).get('/api/legal/privacy');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('Privacy Policy');
  });

  it('GET /api/legal/terms -> 200 text/html containing the zero-tolerance clause', async () => {
    const res = await request(app).get('/api/legal/terms');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('zero tolerance');
  });

  it('serves legal pages without authentication', async () => {
    const res = await request(app).get('/api/legal/privacy');
    expect(res.status).toBe(200);
  });

  it('paints an explicit dark canvas so dark mode does not leave the text on the system background', async () => {
    const res = await request(app).get('/api/legal/terms');
    expect(res.text).toContain('color-scheme:dark');
    expect(res.text).toContain('background:#0c0c0c');
    expect(res.text).toContain('color:#f4f4f5');
    expect(res.text).toContain('viewport-fit=cover');
  });

  it('sends a script-free content security policy and refuses framing', async () => {
    const res = await request(app).get('/api/legal/privacy');
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(res.headers['x-frame-options']).toBe('DENY');
  });
});

describe('renderLegalPage', () => {
  it('escapes the title and leaves the page markup intact', () => {
    const html = renderLegalPage(`A <b> & "x" 'y'`, '<p>Keep</p>');
    expect(html).toContain('<title>A &lt;b&gt; &amp; &quot;x&quot; &#39;y&#39;</title>');
    expect(html).toContain('<p>Keep</p>');
    expect(html).not.toContain('<title>A <b>');
  });
});
