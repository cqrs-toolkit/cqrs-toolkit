[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / PreEvaluatedListFilter

# Interface: PreEvaluatedListFilter

Pre-evaluated [ListFilter](ListFilter.md) produced by the worker-mode proxy
before crossing the structured-clone boundary (closures don't
serialize). On the worker side, `ListParams.filter` shows up in this
form; the inner [QueryManager](../classes/QueryManager.md) normalizes both forms identically.

Consumers should not construct this directly — author [ListFilter](ListFilter.md).

## Properties

### sqlFragment

> **sqlFragment**: `object`

#### bindings

> **bindings**: readonly `unknown`[]

#### sql

> **sql**: `string`
