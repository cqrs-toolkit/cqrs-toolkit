[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ICommandSender

# Interface: ICommandSender\<TLink, TCommand\>

HTTP command sender interface.
Abstracted for testability and different transport implementations.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](EnqueueCommand.md)

## Methods

### send()

> **send**\<`TResponse`\>(`command`): `Promise`\<`Result`\<`TResponse`, [`CommandSendException`](../classes/CommandSendException.md)\>\>

Send a command to the server.

#### Type Parameters

##### TResponse

`TResponse`

#### Parameters

##### command

[`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`, `TResponse`\>

Command record to send

#### Returns

`Promise`\<`Result`\<`TResponse`, [`CommandSendException`](../classes/CommandSendException.md)\>\>

Result with server response or CommandSendException on expected failure
