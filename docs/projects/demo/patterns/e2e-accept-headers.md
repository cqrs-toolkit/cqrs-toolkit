# E2e tests must specify Accept headers explicitly

E2e tests that make direct HTTP requests to a demo's server (via Playwright's `request` fixture, or any other HTTP client) must include an explicit `Accept` header on every request.

```ts
// good
const res = await request.get('/api/todos', {
  headers: { Accept: 'application/json' },
})

// also good — with content negotiation between profiles
const res = await request.get('/api/tasks/123', {
  headers: { Accept: 'application/json', 'Accept-Profile': 'urn:profile:pms:Task;version=1.0.0' },
})

// bad — relies on whatever default Accept the HTTP client sends
const res = await request.get('/api/todos')
```

## Pattern

Every `request.get()`, `request.post()`, `request.put()`, `request.delete()`, `request.patch()` in an e2e test file includes a `headers` object with at minimum an `Accept` value (typically `application/json`, occasionally a specific media type like `application/hal+json` or a profile when content-negotiating against `@cqrs-toolkit/hypermedia`).

## Why this is demo-scoped

Servers in this monorepo (the hypermedia demo's Fastify server, the todo demo's API) use content negotiation to pick the right representation per request.
Relying on the default `Accept` header produces fragile tests:

- The server's default response format may change.
- A profile-aware endpoint may return a different shape than the test expects when no profile is requested.
- A new representation added to an endpoint may quietly break a test that was implicitly receiving the old default.

Explicit `Accept` headers nail down what the test is asserting against.

## Where applied

Demo-system-wide.
All e2e tests under any demo's e2e suite follow this convention.
E2e helpers (`e2e-helpers.ts` files) typically wrap the `request` fixture with a small helper that injects the right defaults.

## Why this is demo-scoped, not repo-scoped

The libraries do not run servers; they have no e2e tests of their own that hit HTTP endpoints.
E2e tests live in the demo system, so the convention does too.
If a future package ever ships its own HTTP-test suite, this can be re-evaluated for promotion to a repo-level pattern.
