[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / HandlerState

# Type Alias: HandlerState\<T\>

> **HandlerState**\<`T`\> = \{ `initial`: `T` \| `undefined`; `mode`: `"initial"`; \} \| \{ `current`: `T` \| `undefined`; `initial`: `T` \| `undefined`; `mode`: `"regenerate"`; \}

Read-model state surfaced to command-level handler functions
(validate, validateAsync, handler).

Discriminated union on `mode`:

- `'initial'` — first invocation at enqueue. Only `initial` is meaningful;
  the handler produces optimistic anticipated events against what the user
  just submitted.
- `'regenerate'` — any subsequent invocation, regardless of trigger
  (server-event delta, id-rewrite cascade, AutoRevision resolution). The
  library always populates `current` with the latest read-model view of the
  command's primary entity so handler behavior is consistent across
  triggers — handlers don't have to special-case why they were re-invoked.

`initial` is the consumer-supplied snapshot from submit, persisted durably
on the command record, constant for the command's lifetime.

`current` is `T | undefined` because the entity may not be in the read
model store yet (e.g. a freshly-created entity whose anticipated events
haven't been folded yet, or an entity outside the active cache). Handlers
tolerate this the same way they did before the shape change — by
defaulting or branching when state is absent.

Handlers that just want "the most current view available" can read
`state.mode === 'regenerate' ? (state.current ?? state.initial) : state.initial`.

Note: this shape applies only to command-level functions. Event Processors
receive a single `state: TModel | undefined` since they're entity-level
reducers and the "what the user saw at submit" concept doesn't apply.

## Type Parameters

### T

`T` = `unknown`

## Type Declaration

\{ `initial`: `T` \| `undefined`; `mode`: `"initial"`; \}

### initial

> **initial**: `T` \| `undefined`

Snapshot the consumer passed at submit.

### mode

> **mode**: `"initial"`

First invocation — produced at enqueue.

\{ `current`: `T` \| `undefined`; `initial`: `T` \| `undefined`; `mode`: `"regenerate"`; \}

### current

> **current**: `T` \| `undefined`

Latest read-model view of the command's primary entity at the moment of
regenerate. `undefined` only when the entity isn't yet in the read-model
store (no overlay folded yet, outside active cache, etc.) — not a
trigger-based signal.

### initial

> **initial**: `T` \| `undefined`

Snapshot the consumer passed at submit. Unchanged from the first call.

### mode

> **mode**: `"regenerate"`

Any subsequent invocation. Trigger may be a server-event delta, an
id-rewrite cascade after a parent command succeeded, or AutoRevision
resolution — handlers don't distinguish.
