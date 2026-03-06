[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / RetryConfig

# Interface: RetryConfig

Defined in: [packages/client/src/types/config.ts:58](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L58)

Retry configuration for commands.

## Properties

### backoffMultiplier?

> `optional` **backoffMultiplier**: `number`

Defined in: [packages/client/src/types/config.ts:66](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L66)

Backoff multiplier

---

### initialDelay?

> `optional` **initialDelay**: `number`

Defined in: [packages/client/src/types/config.ts:62](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L62)

Initial delay in milliseconds

---

### jitter?

> `optional` **jitter**: `boolean`

Defined in: [packages/client/src/types/config.ts:68](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L68)

Add random jitter to delays

---

### maxAttempts?

> `optional` **maxAttempts**: `number`

Defined in: [packages/client/src/types/config.ts:60](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L60)

Maximum retry attempts

---

### maxDelay?

> `optional` **maxDelay**: `number`

Defined in: [packages/client/src/types/config.ts:64](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L64)

Maximum delay in milliseconds
