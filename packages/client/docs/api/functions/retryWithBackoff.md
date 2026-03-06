[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / retryWithBackoff

# Function: retryWithBackoff()

> **retryWithBackoff**\<`T`\>(`fn`, `config?`, `shouldRetryError?`): `Promise`\<`T`\>

Defined in: [packages/client/src/utils/retry.ts:73](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/utils/retry.ts#L73)

Retry a function with exponential backoff.

## Type Parameters

### T

`T`

## Parameters

### fn

() => `Promise`\<`T`\>

Function to retry

### config?

[`RetryConfig`](../interfaces/RetryConfig.md) = `{}`

Retry configuration

### shouldRetryError?

(`error`) => `boolean`

Optional function to determine if error is retryable

## Returns

`Promise`\<`T`\>

Result of the function
