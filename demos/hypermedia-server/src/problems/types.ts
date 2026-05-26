/**
 * RFC 9457 problem+json infrastructure for the hypermedia demo server.
 *
 * Mirrors the production approach in `event-sourcing/packages/common-infrastructure`
 * (see ADR-0006-rfc-9457-problem-json there) but scoped to this demo.
 * Kept self-contained — no imports from other demo packages — so it can be lifted
 * into a shared package later without rewriting consumers.
 */

import type { FieldError } from '@cqrs-toolkit/schema'
import { Exception, type IException } from '@meticoeus/ddd-es'
import type { FastifyReply } from 'fastify'
import type { JSONSchema7 } from 'json-schema'

/**
 * Minimal request shape accepted by `handleErrorReply` — populates the emitted
 * problem's `correlationId` from the request. `headers` is included as a structural
 * anchor so that both `FastifyRequest` (with the augmented `correlationId` field below)
 * and the lighter `Hypermedia.Request` are assignable without TypeScript's
 * "no properties in common" check rejecting the call.
 */
export interface ProblemRequest {
  readonly headers: Readonly<Record<string, string | string[] | undefined>>
  readonly correlationId?: string | undefined
}

export const PROBLEM_CONTENT_TYPE = 'application/problem+json'

/** Service prefix for problem and schema URNs emitted by this demo. */
export const PROBLEM_SERVICE = 'nb'

export interface BaseProblem {
  readonly type: string
  readonly title: string
  readonly status: number
  readonly detail?: string
  readonly instance?: string
  readonly correlationId?: string
}

/** Spread into concrete problem schemas; intentionally has no `$id` and is never registered. */
export const BaseProblemSchema = {
  properties: {
    type: { type: 'string', format: 'uri' },
    title: { type: 'string' },
    status: { type: 'integer' },
    detail: { type: 'string' },
    instance: { type: 'string', format: 'uri' },
    correlationId: { type: 'string' },
  },
  required: ['type', 'title', 'status'],
} satisfies JSONSchema7

export const FieldErrorSchema = {
  $id: `urn:schema:${PROBLEM_SERVICE}.FieldError:1.0.0`,
  title: 'FieldErrorV1_0_0',
  type: 'object',
  properties: {
    path: { type: 'string' },
    code: { type: 'string' },
    message: { type: 'string' },
    params: { type: 'object' },
  },
  required: ['path', 'code', 'message', 'params'],
  additionalProperties: false,
} satisfies JSONSchema7

export interface Problem extends BaseProblem {
  readonly details?: readonly FieldError[]
}

/**
 * Default problem schema referenced by routes that don't carry exception-specific extensions.
 * Spread `BaseProblemSchema` plus an optional `details` array of `FieldError`s for cross-field
 * validation failures (the only extension every endpoint may emit).
 */
export const ProblemSchema = {
  $id: `urn:schema:${PROBLEM_SERVICE}.Problem:1.0.0`,
  title: 'ProblemV1_0_0',
  type: 'object',
  properties: {
    ...BaseProblemSchema.properties,
    details: { type: 'array', items: FieldErrorSchema },
  },
  required: [...BaseProblemSchema.required],
  additionalProperties: false,
} satisfies JSONSchema7

type Mutable<T> = { -readonly [K in keyof T]: T[K] }

export type ExceptionFieldExtractor<
  E extends IException = IException,
  P extends BaseProblem = BaseProblem,
> = (error: E, problem: Mutable<P>) => Mutable<P>

export interface ToProblemOptions {
  correlationId?: string
}

export interface RegisterSchemaParams {
  exceptionName: string
  schema: JSONSchema7
  /** True when `error.details` carries a `FieldError[]` payload to surface as the body's `details`. */
  hasFieldErrorDetails: boolean
}

export interface RegisterCustomParams<E extends IException, P extends BaseProblem> {
  exceptionName: string
  extractor: ExceptionFieldExtractor<E, P>
}

interface SchemaEntry {
  readonly kind: 'schema'
  readonly schema: JSONSchema7
  readonly hasFieldErrorDetails: boolean
}

interface CustomEntry {
  readonly kind: 'custom'
  readonly extractor: ExceptionFieldExtractor
}

type Entry = SchemaEntry | CustomEntry

export class ExceptionRegistry {
  private entries = new Map<string, Entry>()
  private extractors = new Map<string, ExceptionFieldExtractor>()

  public register(params: RegisterSchemaParams): void
  public register<E extends IException, P extends BaseProblem>(
    params: RegisterCustomParams<E, P>,
  ): void
  public register(
    params: RegisterSchemaParams | RegisterCustomParams<IException, BaseProblem>,
  ): void {
    const entry: Entry =
      'extractor' in params
        ? { kind: 'custom', extractor: params.extractor as ExceptionFieldExtractor }
        : {
            kind: 'schema',
            schema: params.schema,
            hasFieldErrorDetails: params.hasFieldErrorDetails,
          }
    this.entries.set(params.exceptionName, entry)
    this.extractors.delete(params.exceptionName)
  }

  public toProblem<P extends BaseProblem = BaseProblem>(
    error: IException,
    opts: ToProblemOptions = {},
  ): P {
    const strippedName = error.name.replace(/Exception$/, '')
    const status = error.code ?? 500

    const problem: Mutable<BaseProblem> = {
      type: `urn:problem:${PROBLEM_SERVICE}.${strippedName}:1.0.0`,
      title: titleFromName(error.name),
      status,
    }
    const detail = error.userMessage ?? error.message
    if (detail) problem.detail = detail
    if (opts.correlationId !== undefined) problem.correlationId = opts.correlationId

    const extractor = this.getExtractor(error)
    if (extractor) extractor(error, problem)
    return problem as P
  }

  private static fieldErrorDetailsExtractor: ExceptionFieldExtractor = (error, problem) => {
    if (isFieldErrorArray(error.details)) {
      ;(problem as Record<string, unknown>).details = error.details
    }
    return problem
  }

  private getExtractor(exception: IException): ExceptionFieldExtractor | undefined {
    const exceptionName = exception.name
    const cached = this.extractors.get(exceptionName)
    if (cached) return cached
    const entry = this.entries.get(exceptionName)
    if (entry) {
      const extractor = buildExtractor(entry)
      this.extractors.set(exceptionName, extractor)
      return extractor
    }

    // Cache the fallback only after a real FieldError[] payload appears — an empty/absent
    // array on first sight may be transient and shouldn't lock the class into "no extras".
    if (!isFieldErrorArray(exception.details)) return undefined
    this.extractors.set(exceptionName, ExceptionRegistry.fieldErrorDetailsExtractor)
    return ExceptionRegistry.fieldErrorDetailsExtractor
  }
}

export const exceptionRegistry = new ExceptionRegistry()

function buildExtractor(entry: Entry): ExceptionFieldExtractor {
  if (entry.kind === 'custom') return entry.extractor

  const props = entry.schema.properties
  const baseProps = BaseProblemSchema.properties
  const keys = props ? Object.keys(props).filter((k) => !(k in baseProps)) : []
  const includeDetails = entry.hasFieldErrorDetails

  return function extractFromSchema(error, problem) {
    const target = problem as Record<string, unknown>
    const source = error as unknown as Record<string, unknown>
    for (const key of keys) {
      const value = source[key]
      if (value !== undefined) target[key] = value
    }
    if (includeDetails && error.details !== undefined) target.details = error.details
    return problem
  }
}

function titleFromName(name: string): string {
  return name
    .replace(/Exception$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
}

function isFieldErrorArray(value: unknown): value is FieldError[] {
  if (!Array.isArray(value) || value.length === 0) return false
  const first = value[0]
  if (first === undefined || first === null || typeof first !== 'object') return false
  const rec = first as Record<string, unknown>
  return (
    typeof rec.path === 'string' &&
    typeof rec.code === 'string' &&
    typeof rec.message === 'string' &&
    typeof rec.params === 'object' &&
    rec.params !== null
  )
}

/**
 * Send an RFC 9457 problem response. Routes call this directly or let the global
 * error handler dispatch through it.
 *
 * `request` is accepted so future content negotiation (`application/ld+json`) can branch.
 */
export function handleErrorReply(
  request: ProblemRequest,
  reply: FastifyReply,
  error: unknown,
): void {
  const problem = getProblem(error, request.correlationId)
  reply.code(problem.status).type(PROBLEM_CONTENT_TYPE).send(problem)
}

function getProblem(error: unknown, correlationId: string | undefined): BaseProblem {
  if (error instanceof Exception) {
    return exceptionRegistry.toProblem(error, { correlationId })
  }

  // Fastify's own validation/parse errors and similar carry a numeric `statusCode`.
  // Surface them with their declared status and message instead of swallowing them as 500s.
  if (
    error instanceof Error &&
    'statusCode' in error &&
    typeof (error as { statusCode?: unknown }).statusCode === 'number' &&
    (error as { statusCode: number }).statusCode !== 500
  ) {
    const status = (error as { statusCode: number }).statusCode
    return {
      type: 'about:blank',
      status,
      title: error.name,
      detail: error.message,
      correlationId,
    }
  }

  return {
    type: 'about:blank',
    status: 500,
    title: 'Error',
    detail: 'Something went wrong',
    correlationId,
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Correlation ID populated by `setupCorrelationIdHook`. */
    correlationId?: string
  }
}
