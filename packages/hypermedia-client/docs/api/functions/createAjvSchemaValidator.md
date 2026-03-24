[**@cqrs-toolkit/hypermedia-client**](../README.md)

---

[@cqrs-toolkit/hypermedia-client](../README.md) / createAjvSchemaValidator

# Function: createAjvSchemaValidator()

> **createAjvSchemaValidator**(`registry?`): `SchemaValidator`\<`JSONSchema7`\>

Create a `SchemaValidator<JSONSchema7>` using AJV.

Registers `common` schemas and `commonCommands` schemas with AJV via
`addSchema()` (registration only, no compilation). Command schemas are
compiled lazily on first `validate()` call — AJV caches compiled validators.

```ts
import { schemas } from './.cqrs/schemas.js'
import { createAjvSchemaValidator } from '@cqrs-toolkit/hypermedia-client'

const config: CqrsConfig<JSONSchema7> = {
  schemaValidator: createAjvSchemaValidator(schemas),
  commandHandlers: withSchemaRegistry(schemas, [...handlers]),
}
```

## Parameters

### registry?

[`SchemaRegistry`](../interfaces/SchemaRegistry.md)

## Returns

`SchemaValidator`\<`JSONSchema7`\>
