[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / isTerminalStatus

# Function: isTerminalStatus()

> **isTerminalStatus**(`status`): `status is TerminalCommandStatus`

Check if command is in a terminal state.

'applied' is questionable and needs to be handled carefully by callers.
The normal lifecycle is 'succeeded' -> 'applied' so naive treatment can double-effect.

## Parameters

### status

[`CommandStatus`](../type-aliases/CommandStatus.md)

## Returns

`status is TerminalCommandStatus`
