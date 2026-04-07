[**@cqrs-toolkit/client**](../../../README.md)

---

[@cqrs-toolkit/client](../../../globals.md) / protocol

# protocol

## Classes

- [RpcError](classes/RpcError.md)
- [WorkerMessageChannel](classes/WorkerMessageChannel.md)
- [WorkerMessageHandler](classes/WorkerMessageHandler.md)

## Interfaces

- [BaseMessage](interfaces/BaseMessage.md)
- [EventMessage](interfaces/EventMessage.md)
- [HeartbeatMessage](interfaces/HeartbeatMessage.md)
- [MessageChannelConfig](interfaces/MessageChannelConfig.md)
- [MessageTarget](interfaces/MessageTarget.md)
- [RegisterWindowRequest](interfaces/RegisterWindowRequest.md)
- [RegisterWindowResponse](interfaces/RegisterWindowResponse.md)
- [RequestMessage](interfaces/RequestMessage.md)
- [ResponseMessage](interfaces/ResponseMessage.md)
- [RestoreHoldsRequest](interfaces/RestoreHoldsRequest.md)
- [RestoreHoldsResponse](interfaces/RestoreHoldsResponse.md)
- [UnregisterWindowMessage](interfaces/UnregisterWindowMessage.md)
- [WorkerInstanceMessage](interfaces/WorkerInstanceMessage.md)
- [WorkerMessageHandlerConfig](interfaces/WorkerMessageHandlerConfig.md)

## Type Aliases

- [WorkerMessage](type-aliases/WorkerMessage.md)

## Functions

- [deserialize](functions/deserialize.md)
- [isEventMessage](functions/isEventMessage.md)
- [isHeartbeatMessage](functions/isHeartbeatMessage.md)
- [isRegisterRequest](functions/isRegisterRequest.md)
- [isRequestMessage](functions/isRequestMessage.md)
- [isResponseMessage](functions/isResponseMessage.md)
- [isRestoreHoldsRequest](functions/isRestoreHoldsRequest.md)
- [isUnregisterMessage](functions/isUnregisterMessage.md)
- [isWorkerInstanceMessage](functions/isWorkerInstanceMessage.md)
- [prepareForTransfer](functions/prepareForTransfer.md)
- [restoreFromTransfer](functions/restoreFromTransfer.md)
- [serialize](functions/serialize.md)
