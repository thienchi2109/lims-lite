/**
 * Provides an in-memory token bucket plus bounded concurrency and queue slots
 * for one authenticated gateway client.
 */
export class ClientLimiter {
  constructor(client, now = Date.now) {
    this.client = client
    this.now = now
    this.active = 0
    this.queue = []
    this.tokens = client.burst
    this.lastRefillAt = now()
  }

  consumeRateToken() {
    const currentTime = this.now()
    const elapsedMs = Math.max(0, currentTime - this.lastRefillAt)
    const refill =
      (elapsedMs * this.client.requestsPerMinute) / (60 * 1_000)

    this.tokens = Math.min(this.client.burst, this.tokens + refill)
    this.lastRefillAt = currentTime

    if (this.tokens < 1) {
      return false
    }

    this.tokens -= 1
    return true
  }

  acquire(signal) {
    if (signal.aborted) {
      return Promise.reject(signal.reason)
    }

    if (this.active < this.client.maxConcurrent) {
      this.active += 1
      return Promise.resolve(this.createRelease())
    }

    if (
      this.client.maxQueue === 0 ||
      this.queue.length >= this.client.maxQueue
    ) {
      return Promise.reject(new QueueFullError())
    }

    return new Promise((resolve, reject) => {
      const waiter = { reject, resolve, signal }
      const handleAbort = () => {
        const index = this.queue.indexOf(waiter)
        if (index >= 0) {
          this.queue.splice(index, 1)
        }
        reject(signal.reason)
      }

      waiter.handleAbort = handleAbort
      signal.addEventListener('abort', handleAbort, { once: true })
      this.queue.push(waiter)
    })
  }

  createRelease() {
    let released = false

    return () => {
      if (released) {
        return
      }
      released = true
      this.active -= 1
      this.startNextQueuedRequest()
    }
  }

  startNextQueuedRequest() {
    while (this.queue.length > 0) {
      const waiter = this.queue.shift()
      waiter.signal.removeEventListener('abort', waiter.handleAbort)

      if (waiter.signal.aborted) {
        waiter.reject(waiter.signal.reason)
        continue
      }

      this.active += 1
      waiter.resolve(this.createRelease())
      return
    }
  }
}

export class QueueFullError extends Error {
  constructor() {
    super('Client conversion queue is full')
    this.name = 'QueueFullError'
  }
}
