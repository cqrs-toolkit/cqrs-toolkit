import { Ajv } from 'ajv'
import { validatorProvider } from './ValidatorProvider.js'

export function bootstrapTestAjv(): void {
  const ajv = new Ajv({ allErrors: true })
  ajv.addFormat('int64', /^[0-9]+$/)
  validatorProvider.setAjv(ajv)
}
