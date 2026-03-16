[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [index](../README.md) / EmbeddableSpec

# Interface: EmbeddableSpec\<Card, Params, Locals, Context\>

EmbeddableSpec: describes a top-level resolvable token.
NOTE: no child/parent nesting here; callers will compose in route formatters.

## Type Parameters

### Card

`Card` _extends_ [`Cardinality`](../type-aliases/Cardinality.md)

### Params

`Params` _extends_ [`BaseResolverParams`](BaseResolverParams.md)

### Locals

`Locals`

### Context

`Context`

## Properties

### cardinality

> **cardinality**: `Card`

'one' | 'many'

---

### className

> **className**: `string`

exact token clients pass (e.g. "pms:DataTag")

---

### parent?

> `optional` **parent**: `object`

Optional: only used to derive keys for this child when params[class].keys not provided

#### className

> **className**: `string`

---

### resolve

> **resolve**: `Card` _extends_ `"one"` ? [`ResolveOne`](../type-aliases/ResolveOne.md)\<`Params`, `Locals`, `Context`\> : [`ResolveMany`](../type-aliases/ResolveMany.md)\<`Params`, `Locals`, `Context`\>

Single resolver for this class
