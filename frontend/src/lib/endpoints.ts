/**
 * VITE_API_URL is documented two ways:
 * - frontend/.env.example includes the `/api` suffix
 * - production examples are the site origin only
 *
 * REST calls need the `/api` prefix. Socket.IO connects to the origin
 * (default namespace, path `/socket.io`). A URL that ends in `/api` would
 * otherwise open the unused `/api` namespace.
 */

function trimTrailingSlash(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function resolveApiBase(raw?: string): string {
  const value = trimTrailingSlash(raw ?? '') || 'http://localhost:3001/api';
  return value.endsWith('/api') ? value : `${value}/api`;
}

export function resolveSocketOrigin(apiRaw?: string, socketRaw?: string): string {
  const socket = trimTrailingSlash(socketRaw ?? '');
  if (socket) {
    return socket.endsWith('/api') ? socket.slice(0, -'/api'.length) : socket;
  }

  const api = trimTrailingSlash(apiRaw ?? '') || 'http://localhost:3001';
  return api.endsWith('/api') ? api.slice(0, -'/api'.length) : api;
}
