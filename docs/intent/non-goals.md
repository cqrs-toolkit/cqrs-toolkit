# Non-goals

What cqrs-toolkit is deliberately *not* trying to be.
Bounding the project's scope is just as important as describing what it does — every "not this" prevents drift into adjacent problem spaces that have their own real solutions.

## Not a generic state-management library

The toolkit is built around CQRS / event sourcing.
It is not a general-purpose state container for arbitrary application state.
If your application doesn't model commands and events, this is not the library you want.

## Not a hosted service

The toolkit ships as a set of npm libraries that a CQRS application uses directly.
There is no "cqrs-toolkit cloud," no managed backend, no SaaS component.
Deployment is the consumer's responsibility.

## Not a framework

The toolkit composes into the consumer's application; the consumer's application does not extend the toolkit.
There are no lifecycle hooks the consumer fills in, no inheritance hierarchies the consumer joins, no template methods.
The libraries provide types, classes, and functions; the consumer wires them together however they like.
The demo system shows one way to wire them; it is not *the* way.

## Not a single deployment topology

The client is built to support multiple execution modes (online-only, dedicated worker, shared worker, Electron utility process).
None is privileged.
The toolkit will not assume one of those is the "real" mode and treat the others as fallbacks; consumers pick what fits their app.

## Not a server runtime

The hypermedia packages serve API construction (Hydra, HAL, content negotiation, embed planning) — they do not bring an HTTP server with them.
The demos use Fastify; consumers can use whatever HTTP framework they like.

## Not a UI library

There are no React/Solid/Vue components shipped from the core packages.
`@cqrs-toolkit/client-solid` is a thin reactive primitive layer for SolidJS consumers; that is the only UI-adjacent code, and it deliberately stops at "thin wrapper around the query manager."
The demos contain UI; the libraries do not.

## Stability is not a current goal

While pre-release ([ADR 0001](../decisions/0001-pre-release-no-back-compat.md)), API stability is explicitly not promised.
Breaking changes happen freely.
This is a deliberate non-goal, not an oversight; once the project ships `1.0.0`, this entry gets updated and stability becomes a goal.
