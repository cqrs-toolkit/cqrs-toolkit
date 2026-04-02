import { SchemaValidator, ValidationError, ValidationException } from '@cqrs-toolkit/client'
import { Err, Ok } from '@meticoeus/ddd-es'
import { Ajv, type ErrorObject } from 'ajv'
import type { JSONSchema7 } from 'json-schema'

export const ajv = new Ajv({ allErrors: true })

export function mapAjvErrors(errors: ErrorObject[] | null | undefined): ValidationError[] {
  if (!errors) return []
  return errors.map((err) => ({
    path:
      err.instancePath.replace(/^\//, '').replaceAll('/', '.') ||
      String(err.params['missingProperty'] ?? ''),
    code: err.keyword,
    message: err.message ?? 'Validation failed',
    params: err.params,
  }))
}

export const schemaValidator: SchemaValidator<JSONSchema7> = {
  validate(schema, data) {
    const validate = ajv.compile(schema)
    if (validate(data)) {
      return Ok(data)
    }
    return Err(new ValidationException(mapAjvErrors(validate.errors)))
  },
}
