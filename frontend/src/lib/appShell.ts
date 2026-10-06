/**
 * Navigation requests the service worker must not answer with the app shell.
 * Workbox tests these against `pathname + search`.
 *
 * `/api` and `/socket.io` share the site origin in production (legal pages,
 * recordings, and the live socket). `/health` is a plain-text probe.
 * File extensions are real assets, not client routes.
 */
export const APP_SHELL_NAVIGATION_DENYLIST: RegExp[] = [
  /^\/api(?:\/|$|\?)/,
  /^\/socket\.io(?:\/|$|\?)/,
  /^\/health(?:\/|$|\?)/,
  /\.(?:png|jpe?g|gif|svg|ico|js|css|map|json|webmanifest|mp3|m4a|wav|woff2?)(?:\?|$)/i,
];

export function shouldServeAppShell(pathnameAndSearch: string): boolean {
  return !APP_SHELL_NAVIGATION_DENYLIST.some((pattern) => pattern.test(pathnameAndSearch));
}
