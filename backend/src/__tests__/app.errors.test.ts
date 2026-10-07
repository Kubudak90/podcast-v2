import { describe, it, expect, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { apiErrorHandler, clientBodyError, createApp } from '../app.js';

describe('clientBodyError', () => {
  it('maps a JSON parse failure to 400 without using the parser message', () => {
    const mapped = clientBodyError({
      type: 'entity.parse.failed',
      status: 400,
      message: 'Unexpected token super-secret-token',
    });

    expect(mapped).toEqual({ status: 400, message: 'Invalid JSON' });
  });

  it('maps an oversized body to 413 from either type or status', () => {
    expect(clientBodyError({ type: 'entity.too.large', status: 413 })).toEqual({
      status: 413,
      message: 'Request body too large',
    });
    expect(clientBodyError({ statusCode: 413 })).toEqual({
      status: 413,
      message: 'Request body too large',
    });
  });

  it('leaves unknown failures for the 500 handler', () => {
    expect(clientBodyError(new Error('database password leaked'))).toBeNull();
    expect(clientBodyError(null)).toBeNull();
  });
});

describe('apiErrorHandler', () => {
  function mockRes() {
    const res = {
      headersSent: false,
      statusCode: 0,
      body: undefined as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      },
    };
    return res;
  }

  it('returns a generic 500 and does not echo the error text', () => {
    const res = mockRes();
    const next = vi.fn();

    apiErrorHandler(
      new Error('database password leaked'),
      { path: '/api/auth/login', method: 'POST' } as Request,
      res as unknown as Response,
      next as NextFunction,
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ message: 'Internal server error' });
    expect(JSON.stringify(res.body)).not.toContain('database password leaked');
    expect(next).not.toHaveBeenCalled();
  });

  it('delegates when the response has already started', () => {
    const res = mockRes();
    res.headersSent = true;
    const next = vi.fn();
    const err = new Error('late');

    apiErrorHandler(
      err,
      { path: '/health', method: 'GET' } as Request,
      res as unknown as Response,
      next,
    );

    expect(next).toHaveBeenCalledWith(err);
    expect(res.statusCode).toBe(0);
  });
});

describe('JSON body errors', () => {
  const app = createApp();

  it('rejects malformed JSON with 400 and does not echo the body', async () => {
    const secret = 'super-secret-token';
    const res = await request(app)
      .post('/health')
      .set('Content-Type', 'application/json')
      .send(`{"password":"${secret}"`);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Invalid JSON' });
    expect(res.text).not.toContain(secret);
    expect(res.text).not.toContain('Unexpected');
  });

  it('rejects a body over 1 MB with 413 and does not echo the body', async () => {
    const marker = 'LEAK-MARKER-413';
    const body = `{"blob":"${marker}${'A'.repeat(1024 * 1024)}"}`;
    const res = await request(app)
      .post('/health')
      .set('Content-Type', 'application/json')
      .send(body);

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ message: 'Request body too large' });
    expect(res.text).not.toContain(marker);
  });

  it('still accepts valid JSON and serves the health check', async () => {
    const parsed = await request(app)
      .post('/health')
      .set('Content-Type', 'application/json')
      .send('{}');
    expect(parsed.status).toBe(404);

    const health = await request(app).get('/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');
  });

  it('lets route validation answer a well-formed body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'x' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid email');
  });
});
