/**
 * Retry utilities with exponential backoff.
 */

import type { RetryConfig } from '../types/config.js'

/**
 * Default retry configuration.
 */
export const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
}

/**
 * Calculate delay for a given attempt using exponential backoff.
 *
 * @param attempt - Current attempt number (1-based)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(attempt: number, config: RetryConfig = {}): number {
  const resolved = { ...DEFAULT_RETRY_CONFIG, ...config }

  // Calculate base delay with exponential backoff
  let delay = resolved.initialDelay * Math.pow(resolved.backoffMultiplier, attempt - 1)

  // Apply max delay cap
  delay = Math.min(delay, resolved.maxDelay)

  // Apply jitter if enabled (±25%)
  if (resolved.jitter) {
    const jitterFactor = 0.75 + Math.random() * 0.5 // 0.75 to 1.25
    delay = Math.floor(delay * jitterFactor)
  }

  return delay
}

/**
 * Check if we should retry based on attempt count.
 *
 * @param attempt - Current attempt number (1-based)
 * @param config - Retry configuration
 * @returns Whether to retry
 */
export function shouldRetry(attempt: number, config: RetryConfig = {}): boolean {
  const maxAttempts = config.maxAttempts ?? DEFAULT_RETRY_CONFIG.maxAttempts
  return attempt < maxAttempts
}

/**
 * Sleep for a given duration.
 *
 * @param ms - Duration in milliseconds
 * @returns Promise that resolves after the duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry a function with exponential backoff.
 *
 * @param fn - Function to retry
 * @param config - Retry configuration
 * @param shouldRetryError - Optional function to determine if error is retryable
 * @returns Result of the function
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {},
  shouldRetryError: (error: unknown) => boolean = () => true,
): Promise<T> {
  const maxAttempts = config.maxAttempts ?? DEFAULT_RETRY_CONFIG.maxAttempts
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (!shouldRetryError(error)) {
        throw error
      }

      if (attempt < maxAttempts) {
        const delay = calculateBackoffDelay(attempt, config)
        await sleep(delay)
      }
    }
  }

  throw lastError
}
