'use strict'

function validateRequestId(requestId) {
  if (typeof requestId !== 'string' || requestId.length < 1 || requestId.length > 128) {
    throw new Error('A local session request ID of 1 to 128 characters is required')
  }
}

/** Prevents abandoned renderer requests from starting or stopping a later session. */
class LocalSessionController {
  constructor(host) {
    this.host = host
    this.generation = 0
    this.current = null
    this.closed = false
  }

  getState() {
    return this.host.getState()
  }

  assertCurrent(request) {
    if (this.closed || this.current !== request || request.generation !== this.generation) {
      throw new Error('Local session request was superseded or stopped')
    }
  }

  start(requestId) {
    validateRequestId(requestId)
    if (this.closed) return Promise.reject(new Error('Local session controller is closed'))
    if (this.current?.id === requestId && this.current.generation === this.generation) {
      if (this.current.pending || this.host.getState().state === 'running') return this.current.promise
    }

    const previous = this.current
    const request = { id: requestId, generation: this.generation, promise: null, pending: true }
    // Publish the replacement before any await, so late cleanup from the former
    // renderer cannot invalidate or stop this request's eventual child process.
    this.current = request
    request.promise = this.startRequest(request, previous)
    return request.promise
  }

  async startRequest(request, previous) {
    try {
      if (previous || this.host.getState().state === 'stopping') await this.host.stop()
      this.assertCurrent(request)
      const descriptor = await this.host.start()
      this.assertCurrent(request)
      request.pending = false
      return descriptor
    } catch (error) {
      if (this.current === request) {
        this.current = null
        // A ready process must remain owned even if its renderer lease expired.
        // Never stop here when a replacement request already owns the host.
        if (request.generation !== this.generation || this.closed) await this.host.stop()
      }
      throw error
    }
  }

  async stop(requestId) {
    validateRequestId(requestId)
    if (this.current?.id !== requestId) return this.getState()
    this.current = null
    await this.host.stop()
    return this.getState()
  }

  async invalidate({ closed = false } = {}) {
    this.generation++
    this.current = null
    if (closed) this.closed = true
    await this.host.stop()
    return this.getState()
  }
}

module.exports = { LocalSessionController }
