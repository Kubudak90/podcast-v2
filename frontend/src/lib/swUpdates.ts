/** Browsers auto-check a controlled service worker about once a day. */
export const SW_UPDATE_INTERVAL_MS = 60 * 60 * 1000

type ServiceWorkerUpdateTarget = Pick<ServiceWorkerRegistration, 'update'>

let stopWatching: (() => void) | undefined

/**
 * Check for a new service worker as soon as registration is ready, again
 * whenever the tab is shown or the network returns, and on a fixed interval.
 * A second call replaces the previous watcher so timers do not stack.
 */
export function attachServiceWorkerUpdates(
  registration: ServiceWorkerUpdateTarget | undefined,
): void {
  stopWatching?.()
  stopWatching = undefined
  if (!registration) return
  stopWatching = watchServiceWorkerUpdates(registration)
}

export function watchServiceWorkerUpdates(
  registration: ServiceWorkerUpdateTarget,
  intervalMs = SW_UPDATE_INTERVAL_MS,
): () => void {
  let stopped = false

  const check = () => {
    if (stopped) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    try {
      void Promise.resolve(registration.update()).catch(() => {
        // The script can be unreachable. A later check tries again.
      })
    } catch {
      // update() threw before returning a promise.
    }
  }

  const onOnline = () => {
    check()
  }

  const onVisibility = () => {
    if (document.visibilityState === 'visible') check()
  }

  check()
  const timer = setInterval(check, intervalMs)
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisibility)

  return () => {
    stopped = true
    clearInterval(timer)
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
