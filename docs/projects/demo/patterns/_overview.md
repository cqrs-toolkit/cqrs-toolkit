# patterns/ (demo)

Demo-system normative conventions — applied across the todo, hypermedia, and electron sub-projects.

## Patterns

- [`css-state-classes.md`](css-state-classes.md) — surface UI state as CSS classes for reliable e2e testing; tests wait on deterministic class transitions instead of polling DOM attributes.
- [`e2e-accept-headers.md`](e2e-accept-headers.md) — explicit `Accept` headers on all e2e HTTP requests so tests exercise the same content-negotiation paths the production client uses.
