# Command handler input: `{ init; current }` state

## Context

Anticipated event handlers in [`0004-command-queue.md`](../intent/requirements/0004-command-queue.md) currently receive a single `state` parameter — the **continuously-updated fold state** from the sync data pipeline's updates to the read model. The handler runs against whatever the read-model says now.

A planned refactor would expand this into a structured state object that also gives the handler an immutable view of submit-time state for comparison:

```ts
handler(command, state: { init: TState; current: TState }, context): ...
```

- `init` — immutable snapshot of read-model state at submit time (NEW). Matches what the user saw when they issued the command.
- `current` — continuously-updated fold state at handler-run time (existing behavior, now under a named field).

The motivation: with both views available, handlers can detect that submit-time state and current state diverge — which means something happened between submit and execution that may or may not be what the user intended.

## Observation

Surfaced during 2026-05-07 review of [`0004`](../intent/requirements/0004-command-queue.md). Per direction at that time, the spec for current intent was aligned first; this future-behavior change is to be added separately, with the *current* intent logged as a change at that point.

## Open questions — conflict handling outputs

Adding `init` makes conflict detection possible, but raises a new question: what does the handler do when it detects a conflict? Today's handler output is binary — produce anticipated events or fail. The redesign likely needs new output options:

- **Conflict detected — surface to user.** State has changed between submit and execution in a way that the handler can't safely resolve automatically. Pause and let the user decide how to proceed.

- **Server already matches — cancel as no-op success.** Current state matches what the command would produce; the command is redundant. The command must not fail (which would propagate failure to dependants), nor literally succeed (no events were produced). Needs a new outcome where:
  - The command is removed from the queue without firing the failure path.
  - Dependent commands (those declaring `dependsOn` on this command) still proceed and execute against the up-to-date state.
  - Anything that was waiting for this command's anticipated events (e.g., optimistic UI overlays) is cleaned up.

- Other edge cases likely surface as design develops — e.g., partial conflicts where some fields can be auto-resolved and others can't, or commands that should retry against new state instead of cancelling.

## Status

Pending. Will land in [`0004`](../intent/requirements/0004-command-queue.md) as a separate refinement after the current-behavior alignment stabilizes. The conflict-handling output design is the harder half of this redesign and will likely warrant its own ADR once the shape stabilizes.
