# explorations/ (hypermedia)

Design alternatives under evaluation for the server-side hypermedia castle; questions to investigate before they become committed scope (a requirement) or a settled choice (an ADR).
Mutable — entries are edited as understanding develops, then resolve up into another wing or are dropped.

## Distinguished from neighbours

- **vs `intent/requirements/`** (not yet present in this castle): requirements describe _what the project commits to building_; explorations describe _what we're considering_.
- **vs `decisions/`** (not yet present in this castle): ADRs are settled choices with rationale; explorations are open questions with candidate answers.

## Naming

Descriptive slugs (`<topic>.md`); no `NNNN-` prefix. Explorations are mutable and can be deleted, so monotonic numbering would be churn for no benefit.

## Entries

- [`jsonschema-ref-class.md`](jsonschema-ref-class.md) — open, deferred. Reshape `svc:jsonSchema` from a URL string into a `svc:JsonSchemaRef` object that carries both the deployment URL (`@id`) and the deployment-invariant URN (`svc:urn`). Driver is `@cqrs-toolkit/hypermedia-client` codegen needing a stable schema identity that survives per-deployment `$id` rewrites. Also surfaces a broader gap: the apidoc does not self-describe its own meta-vocabulary classes.
