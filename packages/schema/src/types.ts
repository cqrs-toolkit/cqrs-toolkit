import { ValidationException } from '@meticoeus/ddd-es'
import type { JSONSchema7 } from 'json-schema'

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

export interface SchemaVisitor {
  /** Unique name, used as key in HydrationPlan maps. */
  readonly name: string
  /** Return true if this schema node needs hydration by this visitor. */
  match(schema: JSONSchema7): boolean
  /**
   * Convert a validated value. Returns the replacement value, or `undefined` to leave
   * the original value unchanged (e.g., when conversion fails on an unexpected input).
   *
   * @param value  The validated string value at the matched path.
   * @param parent The containing object, or `undefined` when hydrating a bare root value.
   *               Allows visitors to inspect sibling fields for union differentiation
   *               (e.g., checking a `type` field to distinguish date vs date-time).
   */
  hydrate(value: string, parent: Record<string, unknown> | undefined): unknown
}

export interface HydrationEnvelope {
  /** All paths needing hydration, including ones containing `*` segments. */
  readonly paths: readonly string[]
  /**
   * Maps each `*` path prefix to property keys the hydrator must skip.
   * When the hydrator encounters a `*` segment in a path, it looks up the `*` prefix
   * here to know which object keys are statically defined properties (not dynamic keys).
   */
  readonly starMap: ReadonlyMap<string, readonly string[]>
}

export type HydrationPlan = ReadonlyMap<string, HydrationEnvelope>
