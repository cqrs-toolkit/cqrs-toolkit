[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [server](../README.md) / EmbedPlanner

# Class: EmbedPlanner\<L, C, Specs\>

Planner that:

- validates tokens
- auto-adds required parents (when a child is requested and the parent is NOT skipped)
  — these auto-added parents do NOT count against maxIncludes
- resolves in two parallel phases (no auto-nesting):
  Phase 1: roots + children with skipped parents
  Phase 2: children with non-skipped parents (derive keys from parent maps)
- supports skip + parentKeys
- is silent when keys are empty/absent (map: undefined)

## Type Parameters

### L

`L`

### C

`C`

### Specs

`Specs` _extends_ readonly [`AnySpec`](../../index/type-aliases/AnySpec.md)\<`L`, `C`\>[]

## Constructors

### Constructor

> **new EmbedPlanner**\<`L`, `C`, `Specs`\>(`specs`, `opts?`): `EmbedPlanner`\<`L`, `C`, `Specs`\>

#### Parameters

##### specs

`Specs`

##### opts?

[`EmbedPlannerOptions`](../interfaces/EmbedPlannerOptions.md) = `{}`

#### Returns

`EmbedPlanner`\<`L`, `C`, `Specs`\>

## Properties

### includes

> `readonly` **includes**: readonly `string`[]

## Accessors

### schema

#### Get Signature

> **get** **schema**(): [`IncludeMetaCollectionSchema`](../interfaces/IncludeMetaCollectionSchema.md)

##### Returns

[`IncludeMetaCollectionSchema`](../interfaces/IncludeMetaCollectionSchema.md)

## Methods

### resolve()

> **resolve**(`qs`, `params`, `locals`, `context`, `options?`): `Promise`\<`Result`\<[`EmbeddedOutput`](../../index/type-aliases/EmbeddedOutput.md)\<`Specs`\>\>\>

Resolve requested embeds (all-or-nothing).

- Err(BadRequestException) for unknown tokens / too many includes.
- Err(5xx Exception) if any resolver throws.
- Ok(EmbeddedOutput) otherwise.

#### Parameters

##### qs

[`Querystring`](../../index/type-aliases/Querystring.md)

##### params

`Partial`\<[`ParamMapFromSpecs`](../../index/type-aliases/ParamMapFromSpecs.md)\<`Specs`\>\>

##### locals

`L`

##### context

`C`

##### options?

[`ResolveOptions`](../interfaces/ResolveOptions.md) = `{}`

#### Returns

`Promise`\<`Result`\<[`EmbeddedOutput`](../../index/type-aliases/EmbeddedOutput.md)\<`Specs`\>\>\>
