[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / RetryConfig

# Interface: RetryConfig

Defined in: packages/client/src/types/config.ts:59

Retry configuration for commands.

## Properties

### backoffMultiplier?

> `optional` **backoffMultiplier**: `number`

Defined in: packages/client/src/types/config.ts:67

Backoff multiplier

***

### initialDelay?

> `optional` **initialDelay**: `number`

Defined in: packages/client/src/types/config.ts:63

Initial delay in milliseconds

***

### jitter?

> `optional` **jitter**: `boolean`

Defined in: packages/client/src/types/config.ts:69

Add random jitter to delays

***

### maxAttempts?

> `optional` **maxAttempts**: `number`

Defined in: packages/client/src/types/config.ts:61

Maximum retry attempts

***

### maxDelay?

> `optional` **maxDelay**: `number`

Defined in: packages/client/src/types/config.ts:65

Maximum delay in milliseconds
