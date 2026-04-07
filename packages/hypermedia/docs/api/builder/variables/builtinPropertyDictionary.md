[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [builder](../README.md) / builtinPropertyDictionary

# Variable: builtinPropertyDictionary

> `const` **builtinPropertyDictionary**: `object`

Built-in property documentation for well-known svc: properties.
Spread into your hydraPropertyDictionary to cover standard pagination/query parameters.

```ts
hydraPropertyDictionary: {
  ...builtinPropertyDictionary,
  'nb:todoId': { schema: { type: 'string' }, description: 'Unique todo identifier' },
  // ...
}
```

## Type Declaration

### svc:afterPosition

> **svc:afterPosition**: `object`

#### svc:afterPosition.description

> **description**: `string` = `'Return events after this position'`

#### svc:afterPosition.schema

> **schema**: `object`

#### svc:afterPosition.schema.type

> **type**: `"string"` = `'string'`

### svc:cursor

> **svc:cursor**: `object`

#### svc:cursor.description

> **description**: `string` = `'Opaque pagination cursor returned by a previous response'`

#### svc:cursor.schema

> **schema**: `object`

#### svc:cursor.schema.type

> **type**: `"string"` = `'string'`

### svc:limit

> **svc:limit**: `object`

#### svc:limit.description

> **description**: `string` = `'Maximum number of items to return'`

#### svc:limit.schema

> **schema**: `object`

#### svc:limit.schema.minimum

> **minimum**: `number` = `1`

#### svc:limit.schema.type

> **type**: `"integer"` = `'integer'`
