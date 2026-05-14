[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / readJsonLdType

# Function: readJsonLdType()

> **readJsonLdType**(`body`): `string` \| `undefined`

Read the `@type` (preferred) or `type` field from a JSON-LD document.
Returns undefined when neither is present or non-string. JSON-LD `@type`
can be an array; this helper returns the first string element in that case.

## Parameters

### body

`unknown`

## Returns

`string` \| `undefined`
