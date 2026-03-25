[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / AsyncValidationContext

# Interface: AsyncValidationContext\<TLink\>

Context provided to `validateAsync` handlers.
Gives access to the local read model for business rule checks
(name uniqueness, permission lookups, etc.).

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Properties

### path?

> `optional` **path**: `unknown`

URL path template values from the command envelope.

---

### queryManager

> **queryManager**: [`IQueryManager`](IQueryManager.md)\<`TLink`\>

Query the local read model store.
