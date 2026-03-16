**@cqrs-toolkit/schema**

---

# @cqrs-toolkit/schema

JSON Schema validation, `$id`/`$ref` linking, and runtime value hydration for event-sourced systems.

Wraps [AJV](https://ajv.js.org/) with automatic sub-schema discovery, composable `$ref` replacement, and a visitor-based hydration layer that converts validated string values into domain types (e.g., int64 strings to `BigInt`).

## Install

```bash
npm install @cqrs-toolkit/schema ajv @meticoeus/ddd-es
```

`ajv` and `@meticoeus/ddd-es` are peer dependencies.

## Entry Points

| Import                       | Purpose                                               |
| ---------------------------- | ----------------------------------------------------- |
| `@cqrs-toolkit/schema`       | Core API: validation, registry, visitors              |
| `@cqrs-toolkit/schema/mocks` | Test helpers: `bootstrapTestAjv`, `prettyErrorResult` |

## Quick Start

### Bootstrap

Initialize the global `validatorProvider` during application startup:

```typescript
import { Ajv } from 'ajv'
import { validatorProvider, int64Visitor } from '@cqrs-toolkit/schema'

const ajv = new Ajv({ allErrors: true })
ajv.addFormat('int64', /^[0-9]+$/)

validatorProvider.setAjv(ajv, [int64Visitor])
```

### Validate and Hydrate

`parse()` validates data against a JSON Schema, applies visitor hydrations, and returns a typed `Result`:

```typescript
import type { JSONSchema7 } from 'json-schema'
import { validatorProvider } from '@cqrs-toolkit/schema'

const schema: JSONSchema7 = {
  type: 'object',
  required: ['name', 'position'],
  properties: {
    name: { type: 'string' },
    position: { type: 'string', format: 'int64' },
  },
}

const result = validatorProvider.parse<{ name: string; position: bigint }>(schema, {
  name: 'Alice',
  position: '42',
})

if (result.ok) {
  result.value.position // bigint(42) — automatically hydrated
} else {
  result.error.details // FieldError[]
}
```

### One-Shot Validation

For schemas constructed at runtime that shouldn't be cached:

```typescript
const result = validatorProvider.parseOnce<{ value: string }>(dynamicSchema, data)
```

## Schema Registry

`SchemaRegistry` walks JSON Schema trees and:

1. **Discovers sub-schemas** with `$id` attributes
2. **Registers them with AJV** so they can be referenced
3. **Replaces inline definitions** with `$ref` pointers for composition
4. **Computes hydration plans** mapping visitor names to paths requiring conversion

```typescript
import { SchemaRegistry, int64Visitor } from '@cqrs-toolkit/schema'
import { Ajv } from 'ajv'

const ajv = new Ajv()
const registry = new SchemaRegistry(ajv, [int64Visitor])

// Sub-schemas with $id are auto-discovered and shared across schemas
const addressSchema: JSONSchema7 = {
  $id: 'urn:schema:Address',
  type: 'object',
  properties: {
    street: { type: 'string' },
    zip: { type: 'string' },
  },
}

const personSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    address: addressSchema, // replaced with { $ref: 'urn:schema:Address' }
  },
}

registry.register(personSchema)
// addressSchema is now registered in AJV and reusable
```

## Custom Visitors

Visitors are plugins that match schema nodes and convert validated string values into domain types.

```typescript
import type { SchemaVisitor } from '@cqrs-toolkit/schema'
import type { JSONSchema7 } from 'json-schema'

const dateVisitor: SchemaVisitor = {
  name: 'date',
  match(schema: JSONSchema7): boolean {
    return schema.type === 'string' && schema.format === 'date-time'
  },
  hydrate(value: string): Date | undefined {
    const d = new Date(value)
    return isNaN(d.getTime()) ? undefined : d
  },
}

// Register during bootstrap
validatorProvider.setAjv(ajv, [int64Visitor, dateVisitor])
```

The built-in `int64Visitor` converts `{ type: "string", format: "int64" }` fields to `BigInt`.

## Error Handling

Validation errors are returned as `Result<T, SchemaException>` — never thrown.
`SchemaException` contains structured `FieldError` objects:

```typescript
interface FieldError {
  readonly path: string // JSON pointer path (e.g., "/name")
  readonly code: string // error code (e.g., "required")
  readonly message: string // human-readable message
  readonly params: Record<string, unknown>
}
```

## Test Helpers

The `@cqrs-toolkit/schema/mocks` entry point provides utilities for test setup:

```typescript
import { bootstrapTestAjv, prettyErrorResult } from '@cqrs-toolkit/schema/mocks'

// Initialize validatorProvider with a test AJV instance + int64Visitor
bootstrapTestAjv()

// Format validation errors for readable test output
const result = validatorProvider.parse(schema, invalidData)
if (!result.ok) {
  console.log(prettyErrorResult(result))
}
```

## API Reference

Full API documentation is generated from source and available at [docs/api](_media/README.md).

## License

MIT
