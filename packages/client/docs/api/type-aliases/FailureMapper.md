[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / FailureMapper

# Type Alias: FailureMapper()

> **FailureMapper** = (`response`) => [`FailureDescriptor`](../interfaces/FailureDescriptor.md)

Function shape for translating a server error response into a
[FailureDescriptor](../interfaces/FailureDescriptor.md). The library exports composable defaults
(`defaultStatusMapper`, `defaultProblemJsonMapper`, `defaultLdJsonMapper`).

Resolution at the queue: per-command `mapFailure` on
`CommandHandlerRegistration` is the sole arbiter when defined (no automatic
cascade); otherwise the global `CqrsConfig.mapFailure` runs (defaulting to
`defaultProblemJsonMapper`). A consumer that wants the global's behaviour
for non-special cases imports the same function reference and calls it
explicitly.

## Parameters

### response

[`ServerErrorResponse`](../interfaces/ServerErrorResponse.md)

## Returns

[`FailureDescriptor`](../interfaces/FailureDescriptor.md)
