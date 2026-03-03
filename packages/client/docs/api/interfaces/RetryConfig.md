[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / RetryConfig

# Interface: RetryConfig

Defined in: packages/client/src/types/config.ts:57

Retry configuration for commands.

## Properties

### backoffMultiplier?

> `optional` **backoffMultiplier**: `number`

Defined in: packages/client/src/types/config.ts:65

Backoff multiplier

---

### initialDelay?

> `optional` **initialDelay**: `number`

Defined in: packages/client/src/types/config.ts:61

Initial delay in milliseconds

---

### jitter?

> `optional` **jitter**: `boolean`

Defined in: packages/client/src/types/config.ts:67

Add random jitter to delays

---

### maxAttempts?

> `optional` **maxAttempts**: `number`

Defined in: packages/client/src/types/config.ts:59

Maximum retry attempts

---

### maxDelay?

> `optional` **maxDelay**: `number`

Defined in: packages/client/src/types/config.ts:63

Maximum delay in milliseconds
