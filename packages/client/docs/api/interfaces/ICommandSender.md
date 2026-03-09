[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ICommandSender

# Interface: ICommandSender

HTTP command sender interface.
Abstracted for testability and different transport implementations.

## Methods

### send()

> **send**\<`TPayload`, `TResponse`\>(`command`): `Promise`\<`TResponse`\>

Send a command to the server.

#### Type Parameters

##### TPayload

`TPayload`

##### TResponse

`TResponse`

#### Parameters

##### command

[`CommandRecord`](CommandRecord.md)\<`TPayload`\>

Command record to send

#### Returns

`Promise`\<`TResponse`\>

Server response

#### Throws

CommandSendError on failure
