/**
 * Browser-compatible assert function.
 *
 * node:assert is not available in browser environments (main thread or web workers).
 * This provides the same invariant-checking behavior used throughout the client package.
 */

class AssertionError extends Error {
  readonly code = 'ERR_ASSERTION'

  constructor(message: string) {
    super(message)
    this.name = 'AssertionError'
  }
}

export function assert(value: unknown, message: string): asserts value {
  if (!value) {
    throw new AssertionError(message)
  }
}

assert.fail = function fail(message: string): never {
  throw new AssertionError(message)
}
