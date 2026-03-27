[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ICommandSender

# Interface: ICommandSender\<TLink\>

HTTP command sender interface.
Abstracted for testability and different transport implementations.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Methods

### send()

> **send**\<`TData`, `TResponse`\>(`command`): `Promise`\<`TResponse`\>

Send a command to the server.

#### Type Parameters

##### TData

`TData`

##### TResponse

`TResponse`

#### Parameters

##### command

[`CommandRecord`](CommandRecord.md)\<`TLink`, `TData`\>

Command record to send

#### Returns

`Promise`\<`TResponse`\>

Server response

#### Throws

CommandSendError on failure
