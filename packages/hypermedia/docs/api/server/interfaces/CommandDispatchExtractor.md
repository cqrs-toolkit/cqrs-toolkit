[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [server](../README.md) / CommandDispatchExtractor

# Interface: CommandDispatchExtractor

## Methods

### getValidationSchema()

> **getValidationSchema**(`cap`): `JSONSchema7`

Extract the validation schema from the capability.
Determines what subset of the capability's full body schema should be validated
against the data passed to validate().

#### Parameters

##### cap

[`CommandCapability`](../../index/namespaces/HydraDoc/classes/CommandCapability.md)\<`string`\>

#### Returns

`JSONSchema7`
