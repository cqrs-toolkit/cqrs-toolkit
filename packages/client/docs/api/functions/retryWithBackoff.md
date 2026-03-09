[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / retryWithBackoff

# Function: retryWithBackoff()

> **retryWithBackoff**\<`T`\>(`fn`, `config?`, `shouldRetryError?`): `Promise`\<`T`\>

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
