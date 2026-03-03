/**
 * Generic validation error types.
 * Validation library agnostic - consumers can populate from Zod, AJV, or any validation system.
 */

/**
 * Generic validation error for a single field.
 */
export interface ValidationError {
  /** Field path (e.g., "email", "address.city", "items[0].name") */
  path: string
  /** Error message for display */
  message: string
  /** Error code for programmatic handling (optional) */
  code?: string
  /** Additional context (optional) */
  context?: Record<string, unknown>
}

/**
 * Validation result type - either success or failure with errors.
 */
export type ValidationResult = { valid: true } | { valid: false; errors: ValidationError[] }

/**
 * Helper to create a validation error.
 */
export function createValidationError(
  path: string,
  message: string,
  code?: string,
  context?: Record<string, unknown>,
): ValidationError {
  return { path, message, code, context }
}

/**
 * Helper to create a successful validation result.
 */
export function validationSuccess(): ValidationResult {
  return { valid: true }
}

/**
 * Helper to create a failed validation result.
 */
export function validationFailure(errors: ValidationError[]): ValidationResult {
  return { valid: false, errors }
}

/**
 * Check if validation result is successful.
 */
export function isValidationSuccess(result: ValidationResult): result is { valid: true } {
  return result.valid
}

/**
 * Check if validation result is a failure.
 */
export function isValidationFailure(
  result: ValidationResult,
): result is { valid: false; errors: ValidationError[] } {
  return !result.valid
}
