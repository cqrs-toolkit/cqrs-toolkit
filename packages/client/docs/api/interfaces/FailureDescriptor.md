[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / FailureDescriptor

# Interface: FailureDescriptor

Result of mapping a [ServerErrorResponse](ServerErrorResponse.md) (or a handler-detected
conflict) to library-actionable failure data.

`category` is the primary axis of dispatch. `errorCode` is a stable
identifier for the specific failure kind (typically a problem+json `type`
URI, ld+json `@type`, or bespoke identifier) that the UI dispatches on for
sub-types beyond the broad category.

## Properties

### category

> **category**: [`FailureCategory`](../type-aliases/FailureCategory.md)

Drives retry decision, lifecycle status routing, cascade behaviour, and UI signaling.

---

### details?

> `optional` **details**: `unknown`

Free-form payload for the UI; the library does not interpret.

---

### errorCode?

> `optional` **errorCode**: `string`

Stable identifier for the specific failure kind.

---

### validationErrors?

> `optional` **validationErrors**: [`ValidationError`](ValidationError.md)[]

Field-level validation errors when the response carries them.
