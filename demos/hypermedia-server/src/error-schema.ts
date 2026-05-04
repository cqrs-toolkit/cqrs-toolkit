/**
 * Generic error response shape used by the global error handler for any
 * uncaught exception (HTTP 500). The handler intentionally does not leak
 * the underlying error message — clients only see `{ message: 'Something
 * went wrong' }`.
 */

import type { JSONSchema7 } from 'json-schema'

export const ErrorSchema: JSONSchema7 = {
  $id: 'urn:schema:nb.Error:1.0.0',
  type: 'object',
  properties: { message: { type: 'string' } },
  required: ['message'],
  additionalProperties: false,
}
