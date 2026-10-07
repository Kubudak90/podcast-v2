import { describe, it, expect, vi } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import { z, ZodSchema } from 'zod';
import { validate, validateQuery } from '../middleware/validate.js';

const bodySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  isPublic: z.boolean().optional().default(true),
  maxSpeakers: z.number().min(1).max(10).optional().default(10),
});

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
  search: z.string().max(100).optional(),
});

function createApp() {
  const app = express();
  app.use(express.json());

  app.post('/body', validate(bodySchema), (req: Request, res: Response) => {
    res.json({ body: req.body });
  });

  app.get('/query', validateQuery(querySchema), (req: Request, res: Response) => {
    res.json({
      query: req.query,
      limitType: typeof req.query.limit,
      offsetType: typeof req.query.offset,
    });
  });

  return app;
}

describe('validate middleware', () => {
  const app = createApp();

  it('writes Zod defaults onto req.body and drops unknown fields', async () => {
    const response = await request(app).post('/body').send({ title: 'Gece yayini', extra: 'nope' });

    expect(response.status).toBe(200);
    expect(response.body.body).toEqual({
      title: 'Gece yayini',
      isPublic: true,
      maxSpeakers: 10,
    });
  });

  it('keeps explicit body values', async () => {
    const response = await request(app).post('/body').send({
      title: 'Kapali',
      isPublic: false,
      maxSpeakers: 3,
    });

    expect(response.status).toBe(200);
    expect(response.body.body).toEqual({
      title: 'Kapali',
      isPublic: false,
      maxSpeakers: 3,
    });
  });

  it('returns 400 and does not call next when the body is invalid', async () => {
    const next = vi.fn();
    const schema = z.object({ title: z.string().min(1, 'Title is required') });
    const req = { body: { title: '' } } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    validate(schema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Title is required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns a generic 400 when parsing throws a non-Zod error', () => {
    const next = vi.fn();
    const schema = {
      parse() {
        throw new Error('boom');
      },
    } as unknown as ZodSchema;
    const req = { body: {} } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    validate(schema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid request data' });
    expect(next).not.toHaveBeenCalled();
  });

  it('coerces query numbers, applies defaults, and strips unknown keys', async () => {
    const response = await request(app).get('/query').query({ limit: '5', evil: '1' });

    expect(response.status).toBe(200);
    expect(response.body.limitType).toBe('number');
    expect(response.body.offsetType).toBe('number');
    expect(response.body.query).toEqual({ limit: 5, offset: 0 });
  });

  it('applies query defaults when the query string is empty', async () => {
    const response = await request(app).get('/query');

    expect(response.status).toBe(200);
    expect(response.body.query).toEqual({ limit: 20, offset: 0 });
  });

  it('keeps optional query strings', async () => {
    const response = await request(app).get('/query').query({ search: 'jazz' });

    expect(response.status).toBe(200);
    expect(response.body.query).toEqual({ limit: 20, offset: 0, search: 'jazz' });
  });

  it('returns 400 for a query value outside the schema', async () => {
    const response = await request(app).get('/query').query({ limit: '0' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBeTruthy();
  });

  it('returns a generic 400 when query parsing throws a non-Zod error', () => {
    const next = vi.fn();
    const schema = {
      parse() {
        throw new Error('boom');
      },
    } as unknown as ZodSchema;
    const req = { query: {} } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    validateQuery(schema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid query parameters' });
    expect(next).not.toHaveBeenCalled();
  });
});
