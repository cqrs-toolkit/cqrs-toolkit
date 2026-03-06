[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / DEFAULT_CONFIG

# Variable: DEFAULT_CONFIG

> `const` **DEFAULT_CONFIG**: `object`

Defined in: [packages/client/src/types/config.ts:292](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/config.ts#L292)

Default configuration values.

## Type Declaration

### cache

> `readonly` **cache**: `object`

#### cache.defaultTtl

> `readonly` **defaultTtl**: `number`

#### cache.evictionPolicy

> `readonly` **evictionPolicy**: `"lru"`

#### cache.maxCacheKeys

> `readonly` **maxCacheKeys**: `1000` = `1000`

#### cache.maxWindows

> `readonly` **maxWindows**: `10` = `10`

### mode

> `readonly` **mode**: `"auto"`

### network

> `readonly` **network**: `object`

#### network.timeout

> `readonly` **timeout**: `30000` = `30000`

### retry

> `readonly` **retry**: `object`

#### retry.backoffMultiplier

> `readonly` **backoffMultiplier**: `2` = `2`

#### retry.initialDelay

> `readonly` **initialDelay**: `1000` = `1000`

#### retry.jitter

> `readonly` **jitter**: `true` = `true`

#### retry.maxAttempts

> `readonly` **maxAttempts**: `3` = `3`

#### retry.maxDelay

> `readonly` **maxDelay**: `30000` = `30000`

### storage

> `readonly` **storage**: `object`

#### storage.dbName

> `readonly` **dbName**: `"cqrs-client"` = `'cqrs-client'`
