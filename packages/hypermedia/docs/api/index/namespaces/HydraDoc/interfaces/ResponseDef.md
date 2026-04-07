[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / ResponseDef

# Interface: ResponseDef

Object form of a response entry.

## Properties

### code

> **code**: `number`

---

### contentType?

> `optional` **contentType**: `string`

Defaults to 'application/json' when omitted.

---

### description?

> `optional` **description**: `string`

---

### schema?

> `optional` **schema**: _typeof_ [`NO_BODY`](../variables/NO_BODY.md) \| `JSONSchema7`

Response body schema. Use NO_BODY for explicitly empty responses.
