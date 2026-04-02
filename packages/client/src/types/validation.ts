/**
 * Generic validation error types.
 * Validation library agnostic - consumers can populate from Zod, AJV, or any validation system.
 */

import { type Result, Exception } from '@meticoeus/ddd-es'

export class ValidationException extends Exception<ValidationError[]> {
  constructor(
    details: ValidationError[],
    message: string = 'Validation failed. See `details` for more information.',
  ) {
    super('ValidationException', message, 400)
    this._details = details
  }
}

export function isValidationException(e: unknown): e is ValidationException {
  return typeof e === 'object' && (e as any)?.name === 'ValidationException'
}

/**
 * Generic validation error for a single field.
 */
export interface ValidationError {
  /** Field path (e.g., "email", "address.city", "items[0].name") */
  path: string
  /** Error code for programmatic handling */
  code: string
  /** Error message for display */
  message: string
  /** Additional context */
  params: Record<string, unknown>
}

/**
 * Validation result type - either success or failure with validation errors.
 */
export type ValidationResult = Result<void, ValidationException>
