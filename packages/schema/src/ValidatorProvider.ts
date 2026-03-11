import { Err, Ok, Result } from '@meticoeus/ddd-es'
import type { Ajv, ErrorObject, ValidateFunction } from 'ajv'
import type { JSONSchema7 } from 'json-schema'
import assert from 'node:assert'
import { EMPTY_STAR_MAP, SchemaRegistry } from './SchemaRegistry.js'
import { HydrateFn, SchemaException } from './types.js'
import { applyBigInt, buildInt64Paths, transformAjvErrors } from './utils.js'

class ValidatorProvider {
  private _ajv: Ajv | undefined

  public get ajv(): Ajv {
    assert(this._ajv, 'ValidatorProvider: not initialized. Call setAjv() during bootstrap.')
    return this._ajv
  }

  public setAjv(ajv: Ajv): void {
    this._ajv = ajv
    this._registry = new SchemaRegistry(ajv)
  }

  private _registry: SchemaRegistry | undefined

  public get registry(): SchemaRegistry {
    assert(this._registry, 'ValidatorProvider: not initialized. Call setAjv() during bootstrap.')
    return this._registry
  }

  public getValidator(schema: JSONSchema7): ValidateFunction {
    return this.registry.compile(schema)
  }

  /**
   * Compile, validate, and immediately remove the schema from AJV's internal cache.
   * Use for schemas constructed at runtime (e.g., per form field configuration)
   * that can't be cached by reference without unbounded memory growth.
   */
  public validateOnce(
    schema: JSONSchema7,
    value: unknown,
  ): { valid: boolean; errors: ErrorObject[] | null | undefined } {
    assert(this._ajv, 'ValidatorProvider: AJV instance not set. Call setAjv() during bootstrap.')

    const validate = this._ajv.compile(schema)
    const result = validate(value)
    const errors = validate.errors
    this._ajv.removeSchema(schema)
    return { valid: result, errors }
  }

  /**
   * Cached validation + automatic int64 hydration + optional custom hydrate.
   */
  public parse<T>(
    schema: JSONSchema7,
    value: unknown,
    hydrate?: HydrateFn,
  ): Result<T, SchemaException> {
    const validate = this.getValidator(schema)
    if (!validate(value)) {
      const fieldErrors = transformAjvErrors(validate.errors ?? [])
      return Err(new SchemaException(fieldErrors))
    }

    const envelope = this.registry.getInt64Paths(schema)
    if (envelope.paths.length > 0) applyBigInt(value, envelope)
    hydrate?.(value)

    return Ok(value as T)
  }

  /**
   * Parse using a schema that is constructed at runtime and should not be cached.
   *
   * **Purpose**: for schemas constructed at runtime (e.g., per form field configuration)
   * that can't be cached by reference without unbounded memory growth.
   *
   * **Tradeoff**: compile+validate+remove has per-call compilation cost (microseconds for
   * small schemas), comparable to Zod's per-call approach being replaced. Cached
   * `parseJsonSchema()` is faster (Map lookup) but leaks memory for dynamic schemas.
   *
   * **When to switch to custom validation**: if this becomes a hot path (thousands of
   * validations/sec), replace with manual `typeof`/enum/regex checks returning
   * `Result<void, SchemaException>` — eliminates compilation overhead and GC pressure,
   * but requires maintaining validation parity with AJV and separate unit tests.
   */
  public parseOnce<T>(
    schema: JSONSchema7,
    value: unknown,
    hydrate?: HydrateFn,
  ): Result<T, SchemaException> {
    const { valid, errors } = this.validateOnce(schema, value)
    if (!valid) {
      const fieldErrors = transformAjvErrors(errors ?? [])
      return Err(new SchemaException(fieldErrors))
    }

    const int64Paths = buildInt64Paths(schema)
    if (int64Paths.length > 0) applyBigInt(value, { paths: int64Paths, starMap: EMPTY_STAR_MAP })
    hydrate?.(value)

    return Ok(value as T)
  }
}

export const validatorProvider = new ValidatorProvider()
