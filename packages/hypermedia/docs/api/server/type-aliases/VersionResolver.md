[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [server](../README.md) / VersionResolver

# Type Alias: VersionResolver()\<Locals, Context, Request\>

> **VersionResolver**\<`Locals`, `Context`, `Request`\> = (`request`, `reply`, `locals`, `context`) => `Promise`\<`Result`\<[`ResolvedValue`](../interfaces/ResolvedValue.md) \| [`RepliedValue`](../interfaces/RepliedValue.md), `IException`\>\>

## Type Parameters

### Locals

`Locals`

### Context

`Context`

### Request

`Request` _extends_ [`Request`](../namespaces/Hypermedia/interfaces/Request.md) = [`Request`](../namespaces/Hypermedia/interfaces/Request.md)

## Parameters

### request

`Request`

### reply

`FastifyReply`

### locals

`Locals`

### context

`Context`

## Returns

`Promise`\<`Result`\<[`ResolvedValue`](../interfaces/ResolvedValue.md) \| [`RepliedValue`](../interfaces/RepliedValue.md), `IException`\>\>
