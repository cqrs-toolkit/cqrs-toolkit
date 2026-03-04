[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / RetryConfig

# Interface: RetryConfig

Defined in: packages/client/src/types/config.ts:58

Retry configuration for commands.

## Properties

### backoffMultiplier?

> `optional` **backoffMultiplier**: `number`

Defined in: packages/client/src/types/config.ts:66

Backoff multiplier

---

### initialDelay?

> `optional` **initialDelay**: `number`

Defined in: packages/client/src/types/config.ts:62

Initial delay in milliseconds

---

### jitter?

> `optional` **jitter**: `boolean`

Defined in: packages/client/src/types/config.ts:68

Add random jitter to delays

---

### maxAttempts?

> `optional` **maxAttempts**: `number`

Defined in: packages/client/src/types/config.ts:60

Maximum retry attempts

---

### maxDelay?

> `optional` **maxDelay**: `number`

Defined in: packages/client/src/types/config.ts:64

Maximum delay in milliseconds
