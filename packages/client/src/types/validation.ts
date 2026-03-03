/**
 * Generic validation error types.
 * Validation library agnostic - consumers can populate from Zod, AJV, or any validation system.
 */

import {
  Err,
  type ErrResult,
  Ok,
  type OkResult,
  type Result,
  ValidationException,
} from '@meticoeus/ddd-es'

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
 * Validation result type - either success or failure with validation errors.
 */
export type ValidationResult = Result<void, ValidationException<ValidationError[]>>

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
  return Ok()
}

/**
 * Helper to create a failed validation result.
 */
export function validationFailure(errors: ValidationError[]): ValidationResult {
  return Err(new ValidationException(undefined, errors))
}

/**
 * Check if validation result is successful.
 */
export function isValidationSuccess(result: ValidationResult): result is OkResult<void> {
  return result.ok
}

/**
 * Check if validation result is a failure.
 */
export function isValidationFailure(
  result: ValidationResult,
): result is ErrResult<ValidationException<ValidationError[]>> {
  return !result.ok
}
