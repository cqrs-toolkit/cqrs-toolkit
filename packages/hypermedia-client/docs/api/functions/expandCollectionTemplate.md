[**@cqrs-toolkit/hypermedia-client**](../README.md)

---

[@cqrs-toolkit/hypermedia-client](../globals.md) / expandCollectionTemplate

# Function: expandCollectionTemplate()

> **expandCollectionTemplate**(`template`, `variables`): `string`

Expand an RFC 6570 URI template against a variables map.

Supports the subset the toolkit's representations actually use:

- **Simple path expansion** (`{var}`) — required, percent-encoded. Throws when
  the variable is missing from the map.
- **Form-style query expansion** (`{?var,var,...}` or continuation `{&var,...}`) —
  each variable is optional; missing entries are omitted; present entries are
  percent-encoded as `name=value` and joined with `&`. The prefix is `?` for
  `{?...}` and `&` for `{&...}`.

Other RFC 6570 operators are out of scope: `{+var}`, `{#var}` (fragment),
`{var*}` (explode), reserved expansion, etc. — none of the toolkit's emitted
templates use them. `{#...}` fragment expansion is silently dropped if present.

## Parameters

### template

`string`

### variables

`Record`\<`string`, `string`\>

## Returns

`string`
