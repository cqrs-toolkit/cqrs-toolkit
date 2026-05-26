[**@cqrs-toolkit/hypermedia-client**](../README.md)

---

[@cqrs-toolkit/hypermedia-client](../globals.md) / AggregateRegistry

# Type Alias: AggregateRegistry\<TLink\>

> **AggregateRegistry**\<`TLink`\> = `Record`\<`string`, `AggregateConfig`\<`TLink`\>\>

Maps aggregate URNs (`urn:aggregate:{service.}{Type}`) to their runtime
AggregateConfig. Consumers maintain this and pass it to
[getGeneratedIdReferences](../functions/getGeneratedIdReferences.md).

## Type Parameters

### TLink

`TLink` _extends_ `Link` = `Link`
