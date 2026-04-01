/**
 * AJV-based schema validator for JSON Schema command validation.
 */

import {
  CommandHandlerRegistration,
  EnqueueCommand,
  IAnticipatedEvent,
  SchemaValidator,
  ValidationError,
} from '@cqrs-toolkit/client'
import { Err, Link, Ok, ValidationException } from '@meticoeus/ddd-es'
import { Ajv, type ErrorObject } from 'ajv'
import type { JSONSchema7 } from 'json-schema'

/**
 * Schema map: command name → JSON schema.
 */
export type SchemaMap = Record<string, JSONSchema7>

/**
 * Generated schema registry.
 *
 * - `commands` — command name → data schema (extracted at build time). Ready for client validation.
 * - `common` — $ref dependencies keyed by `$id` URL. Only schemas still referenced after extraction.
 * - `commonCommands` — command keys whose schemas are also used as `$ref` targets by other schemas.
 *   Registered with AJV alongside `common` to avoid duplication.
 */
export interface SchemaRegistry {
  commands: SchemaMap
  common: Record<string, JSONSchema7>
  commonCommands?: string[]
}

function mapAjvErrors(errors: ErrorObject[] | null | undefined): ValidationError[] {
  if (!errors) return []
  return errors.map((err) => ({
    path:
      err.instancePath.replace(/^\//, '').replaceAll('/', '.') ||
      String(err.params['missingProperty'] ?? ''),
    message: err.message ?? 'Validation failed',
    code: err.keyword,
  }))
}

/**
 * Inject schemas from a registry onto command handler registrations.
 *
 * For each handler without an explicit `schema`, looks up
 * `registry.commands[handler.commandType]`. If found, returns a copy with
 * `schema` set. Handlers that already have a `schema` property are not modified.
 *
 * ```ts
 * import { schemas } from './.cqrs/schemas.js'
 * import { withSchemaRegistry } from '@cqrs-toolkit/hypermedia-client'
 *
 * commandHandlers: withSchemaRegistry(schemas, [
 *   ...todoHandlers,
 *   ...noteHandlers,
 * ])
 * ```
 */
export function withSchemaRegistry<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TEvent extends IAnticipatedEvent,
>(
  registry: SchemaRegistry,
  handlers: CommandHandlerRegistration<TLink, TCommand, JSONSchema7, TEvent>[],
): CommandHandlerRegistration<TLink, TCommand, JSONSchema7, TEvent>[] {
  return handlers.map((handler) => {
    if (handler.schema !== undefined) return handler
    const schema = registry.commands[handler.commandType]
    if (schema === undefined) return handler
    return { ...handler, schema }
  })
}

/**
 * Create a `SchemaValidator<JSONSchema7>` using AJV.
 *
 * Registers `common` schemas and `commonCommands` schemas with AJV via
 * `addSchema()` (registration only, no compilation). Command schemas are
 * compiled lazily on first `validate()` call — AJV caches compiled validators.
 *
 * ```ts
 * import { schemas } from './.cqrs/schemas.js'
 * import { createAjvSchemaValidator } from '@cqrs-toolkit/hypermedia-client'
 *
 * const config: CqrsConfig<Link, JSONSchema7> = {
 *   schemaValidator: createAjvSchemaValidator(schemas),
 *   commandHandlers: withSchemaRegistry(schemas, [...handlers]),
 * }
 * ```
 */
export function createAjvSchemaValidator(registry?: SchemaRegistry): SchemaValidator<JSONSchema7> {
  const ajv = new Ajv({ allErrors: true })

  if (registry) {
    // Register common $ref dependencies (cheap — no compilation)
    for (const schema of Object.values(registry.common)) {
      ajv.addSchema(schema)
    }

    // Register command schemas that are also $ref targets
    if (registry.commonCommands) {
      for (const key of registry.commonCommands) {
        const schema = registry.commands[key]
        if (schema) {
          ajv.addSchema(schema)
        }
      }
    }
  }

  return {
    validate(schema, data) {
      let validate
      try {
        validate = ajv.compile(schema)
      } catch (err) {
        console.error('[schema-validator] Failed to compile schema:', schema.$id ?? schema, err)
        throw err
      }
      if (validate(data)) {
        return Ok(data)
      }
      const errors = mapAjvErrors(validate.errors)
      console.debug('[schema-validator] Validation failed:', { schemaId: schema.$id, errors, data })
      return Err(new ValidationException(undefined, errors))
    },
  }
}
