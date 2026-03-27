[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SeedOnDemandConfig

# Interface: SeedOnDemandConfig\<TLink\>

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Properties

### keyTypes

> `readonly` **keyTypes**: readonly [`CacheKeyMatcher`](../type-aliases/CacheKeyMatcher.md)\<`TLink`\>[]

Cache key types that activate this collection for on-demand seeding.
When `client.seed(identity)` is called and the identity matches one of
these matchers, this collection is seeded under that cache key.

## Methods

### subscribeTopics()

> **subscribeTopics**(`cacheKey`): `string`[]

Web socket topic patterns to subscribe to for a given cache key.
Called when a cache key is acquired (seeded or on-demand).
Return `[]` for no subscription.

#### Parameters

##### cacheKey

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

Cache key identity being subscribed

#### Returns

`string`[]

Topic patterns for WS subscription
