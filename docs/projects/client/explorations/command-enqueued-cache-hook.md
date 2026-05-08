# `onCommandEnqueued` cache-driven hook

## Context

[`§4.11`](../intent/requirements/0004-command-queue.md#411-optional-command-driven-cache-behavior-configurable) of `0004-command-queue.md` sketches an optional callback the Command Queue can invoke at enqueue time:

```ts
onCommandEnqueued(command) -> { touchKeys?: CacheKeySpec[]; freezeKeys?: CacheKeySpec[] } | null
```

The intent: let applications automatically load data needed to observe command effects, or freeze relevant cache keys while commands are pending.

## Observation

Surfaced during 2026-05-07 review. None of `onCommandEnqueued`, `touchKeys`, `freezeKeys`, or `CacheKeySpec` exist in code. The hook was deferred — never implemented. Per the user's direction during this review, the [`§4.11`](../intent/requirements/0004-command-queue.md#411-optional-command-driven-cache-behavior-configurable) entry stays in the spec as intent; revisiting is on the future-work list.

## Open questions

- Is `CacheKeySpec` a useful abstraction in the era of `CacheKeyTemplate` / `CacheKeyIdentity`? Probably needs to be re-shaped to align with the post-redesign cache-key model.
- Should this hook live on the Command Queue or on the consumer's command sender? Either layer can observe enqueue events.
- Is freezing-keys-while-pending really an enqueue-time concern, or better expressed via a per-command annotation? E.g., `command.freezesKeys: CacheKeyIdentity[]`.

## Status

Optional, deferred. No active driver.
