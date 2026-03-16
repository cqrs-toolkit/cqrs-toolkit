import {
  AnticipatedEvent,
  type CommandHandlerRegistration,
  ValidationError,
  isAutoRevision,
} from '@cqrs-toolkit/client'

export const MUTATE_CONFIG: Partial<CommandHandlerRegistration<AnticipatedEvent>> = {
  revisionField: 'revision',
}

export function requireNonEmpty(payload: unknown, ...fields: string[]): ValidationError[] {
  if (!isObject(payload)) return [{ path: '', message: 'Invalid payload' }]
  const errors: ValidationError[] = []
  for (const field of fields) {
    const value = payload[field]
    // Skip AUTO_REVISION markers — the library resolves these before send
    if (isAutoRevision(value)) continue
    if (typeof value !== 'string' || value.length === 0) {
      errors.push({ path: field, message: `${field} must not be empty` })
    }
  }
  return errors
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
