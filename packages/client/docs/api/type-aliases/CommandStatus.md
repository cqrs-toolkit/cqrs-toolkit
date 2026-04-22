[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandStatus

# Type Alias: CommandStatus

> **CommandStatus** = `"pending"` \| `"blocked"` \| `"sending"` \| `"succeeded"` \| `"applied"` \| `"failed"` \| `"cancelled"`

Command lifecycle status.

`'applied'` is **post-terminal** — it is not part of TerminalCommandStatus.
A command reaches `'applied'` after its effects are reflected in `serverData`,
which the sync pipeline establishes by observing either the command's response
events or per-aggregate revision/eviction coverage.
