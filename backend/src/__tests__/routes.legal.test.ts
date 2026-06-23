import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

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
});
