[**@cqrs-toolkit/hypermedia-client**](../README.md)

---

[@cqrs-toolkit/hypermedia-client](../README.md) / AfterSendHandler

# Type Alias: AfterSendHandler()\<TLink, TCommand\>

> **AfterSendHandler**\<`TLink`, `TCommand`\> = (`command`, `body`, `response`) => `Promise`\<`Result`\<`unknown`, `CommandSendException`\>\>

Hook called after a successful (2xx) command response, before `send()` returns.

Registered per command type. Receives the command record, the parsed JSON body,
and the raw Response. Must return the final body to use as the command result.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ `EnqueueCommand`

## Parameters

### command

`CommandRecord`\<`TLink`, `TCommand`\>

### body

`unknown`

### response

`Response`

## Returns

`Promise`\<`Result`\<`unknown`, `CommandSendException`\>\>
