/** GUI actions may return native promises or promise-compatible addon values. */
export function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function') &&
    'then' in value && typeof value.then === 'function'
}
