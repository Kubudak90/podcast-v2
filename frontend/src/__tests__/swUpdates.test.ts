import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  attachServiceWorkerUpdates,
  SW_UPDATE_INTERVAL_MS,
  watchServiceWorkerUpdates,
} from '../lib/swUpdates'

describe('service worker updates', () => {
  const stops: Array<() => void> = []

  afterEach(() => {
    for (const stop of stops) stop()
    stops.length = 0
    attachServiceWorkerUpdates(undefined)
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => true,
    })
    vi.useRealTimers()
  })

  it('checks as soon as the worker is registered', () => {
    vi.useFakeTimers()
    const update = vi.fn().mockResolvedValue(undefined)
    stops.push(watchServiceWorkerUpdates({ update }))
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('checks again after an hour', () => {
    vi.useFakeTimers()
    const update = vi.fn().mockResolvedValue(undefined)
    stops.push(watchServiceWorkerUpdates({ update }))
    vi.advanceTimersByTime(SW_UPDATE_INTERVAL_MS)
    expect(update).toHaveBeenCalledTimes(2)
  })

  it('keeps checking when an update attempt fails', async () => {
    vi.useFakeTimers()
    const update = vi.fn().mockRejectedValue(new Error('offline'))
    stops.push(watchServiceWorkerUpdates({ update }))
    await Promise.resolve()
    expect(update).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(SW_UPDATE_INTERVAL_MS)
    expect(update).toHaveBeenCalledTimes(2)
  })

  it('does not throw when update throws synchronously', () => {
    vi.useFakeTimers()
    const update = vi.fn(() => {
      throw new Error('boom')
    })
    expect(() => {
      stops.push(watchServiceWorkerUpdates({ update }))
    }).not.toThrow()
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('checks again when the tab becomes visible', () => {
    vi.useFakeTimers()
    const update = vi.fn().mockResolvedValue(undefined)
    stops.push(watchServiceWorkerUpdates({ update }))
    document.dispatchEvent(new Event('visibilitychange'))
    expect(update).toHaveBeenCalledTimes(2)
  })

  it('does not check when the tab is hidden', () => {
    vi.useFakeTimers()
    const update = vi.fn().mockResolvedValue(undefined)
    const previous = Object.getOwnPropertyDescriptor(document, 'visibilityState')
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })
    try {
      stops.push(watchServiceWorkerUpdates({ update }))
      document.dispatchEvent(new Event('visibilitychange'))
      expect(update).toHaveBeenCalledTimes(1)
    } finally {
      if (previous) Object.defineProperty(document, 'visibilityState', previous)
    }
  })

  it('waits for the network when the first check is offline', () => {
    vi.useFakeTimers()
    const update = vi.fn().mockResolvedValue(undefined)
    const previous = Object.getOwnPropertyDescriptor(navigator, 'onLine')
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => false,
    })
    try {
      stops.push(watchServiceWorkerUpdates({ update }))
      expect(update).not.toHaveBeenCalled()
      vi.advanceTimersByTime(SW_UPDATE_INTERVAL_MS)
      expect(update).not.toHaveBeenCalled()
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: () => true,
      })
      window.dispatchEvent(new Event('online'))
      expect(update).toHaveBeenCalledTimes(1)
    } finally {
      if (previous) Object.defineProperty(navigator, 'onLine', previous)
    }
  })

  it('stops checking after the watcher is released', () => {
    vi.useFakeTimers()
    const update = vi.fn().mockResolvedValue(undefined)
    const stop = watchServiceWorkerUpdates({ update })
    stop()
    vi.advanceTimersByTime(SW_UPDATE_INTERVAL_MS * 2)
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('online'))
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('replaces the previous watcher so intervals do not stack', () => {
    vi.useFakeTimers()
    const first = vi.fn().mockResolvedValue(undefined)
    const second = vi.fn().mockResolvedValue(undefined)
    attachServiceWorkerUpdates({ update: first })
    attachServiceWorkerUpdates({ update: second })
    vi.advanceTimersByTime(SW_UPDATE_INTERVAL_MS)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(3)
  })
})
