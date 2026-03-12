[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / clientSchema

# Variable: clientSchema

> `const` **clientSchema**: `object`

Library schema steps.

Consumers include these in their migration sequence:

```ts
steps: [clientSchema.init, { type: 'managed', name: 'todos' }]
```

## Type Declaration

### init

> **init**: `object`

#### init.id

> **id**: `string` = `'init'`

#### init.sql

> **sql**: `string`[]

#### init.type

> **type**: `"library"` = `'library'`

#### init.version

> **version**: `number` = `1`
