import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    env: process.env.NODE_ENV || 'development',
  },
});

// Request logging helper
export function logRequest(method: string, path: string, statusCode: number, durationMs: number, userId?: string) {
  logger.info({
    type: 'request',
    method,
    path,
    statusCode,
    durationMs,
    userId,
  });
}

// Error logging helper
export function logError(error: Error, context?: Record<string, unknown>) {
  logger.error({
    type: 'error',
    message: error.message,
    stack: error.stack,
    ...context,
  });
}

// Auth logging helper
export function logAuth(
  action: 'login' | 'register' | 'logout' | 'profile_update' | 'google_login' | 'apple_login',
  userId: string,
  username: string,
  success: boolean
) {
  logger.info({
    type: 'auth',
    action,
    userId,
    username,
    success,
  });
}

// Room logging helper
export function logRoom(
  action: 'create' | 'join' | 'leave' | 'start' | 'end' | 'role_change',
  roomSlug: string,
  userId: string,
  details?: Record<string, unknown>
) {
  logger.info({
    type: 'room',
    action,
    roomSlug,
    userId,
    ...details,
  });
}

// Recording logging helper
export function logRecording(action: 'start' | 'stop' | 'error', roomSlug: string, egressId?: string, error?: string) {
  logger.info({
    type: 'recording',
    action,
    roomSlug,
    egressId,
    error,
  });
}

export default logger;
