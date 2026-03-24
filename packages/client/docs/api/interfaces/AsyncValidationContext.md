[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / AsyncValidationContext

# Interface: AsyncValidationContext

Context provided to `validateAsync` handlers.
Gives access to the local read model for business rule checks
(name uniqueness, permission lookups, etc.).

## Properties

### queryManager

> **queryManager**: [`IQueryManager`](IQueryManager.md)

Query the local read model store.
