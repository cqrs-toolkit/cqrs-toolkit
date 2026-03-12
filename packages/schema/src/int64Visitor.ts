import type { JSONSchema7 } from 'json-schema'
import type { SchemaVisitor } from './types.js'

export const int64Visitor: SchemaVisitor = {
  name: 'int64',
  match(schema: JSONSchema7): boolean {
    return schema.type === 'string' && schema.format === 'int64'
  },
  hydrate(value: string, _parent: Record<string, unknown> | undefined): bigint | undefined {
    if (value === '') return undefined
    try {
      return BigInt(value)
    } catch {
      return undefined
    }
  },
}
