import { ValidationException } from '@meticoeus/ddd-es'

export type HydrateFn = (data: unknown) => void

export interface FieldError {
  readonly path: string
  readonly code: string
  readonly message: string
  readonly params: Record<string, unknown>
}

export class SchemaException extends ValidationException<FieldError[]> {
  constructor(errors: FieldError[]) {
    super('SchemaException', errors, 'Validation failed. See `details` for more information.')
  }
}
