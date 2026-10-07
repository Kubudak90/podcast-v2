import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

function validationMessage(error: ZodError): string {
  return error.issues.map((issue) => issue.message).join(', ');
}

/**
 * Express 5 defines `req.query` as a prototype getter that reparses the
 * raw query string on every read, and it has no setter. Mutating the
 * object it returns is lost on the next read, and assignment throws.
 * An own property shadows that getter so handlers see the parsed value.
 */
function applyParsedQuery(req: Request, parsed: Record<string, unknown>): void {
  Object.defineProperty(req, 'query', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: parsed,
  });
}

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: validationMessage(error) });
      }
      return res.status(400).json({ message: 'Invalid request data' });
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.query);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        applyParsedQuery(req, parsed as Record<string, unknown>);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: validationMessage(error) });
      }
      return res.status(400).json({ message: 'Invalid query parameters' });
    }
  };
}
