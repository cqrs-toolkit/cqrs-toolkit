[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / RetryConfig

# Interface: RetryConfig

Retry configuration for commands.

## Properties

### backoffMultiplier?

> `optional` **backoffMultiplier**: `number`

Backoff multiplier

---

### initialDelay?

> `optional` **initialDelay**: `number`

Initial delay in milliseconds

---

### jitter?

> `optional` **jitter**: `boolean`

Add random jitter to delays

---

### maxAttempts?

> `optional` **maxAttempts**: `number`

Maximum retry attempts

---

### maxDelay?

> `optional` **maxDelay**: `number`

Maximum delay in milliseconds
