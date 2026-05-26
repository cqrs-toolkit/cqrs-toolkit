[**@cqrs-toolkit/hypermedia-client**](../README.md)

---

[@cqrs-toolkit/hypermedia-client](../globals.md) / fetchSeedRecordPage

# Function: fetchSeedRecordPage()

> **fetchSeedRecordPage**(`opts`): `Promise`\<`SeedRecordPage`\>

Fetch a page of read-model records from a hypermedia collection endpoint.

Sends `Accept: application/hal+json, application/json;q=0.9`; selects the
parser by the response `Content-Type`. The server is the arbiter.

- `application/hal+json` → HAL parser: members come from `_embedded.item`;
  each member's `_links` is stripped; `nextCursor` is extracted from
  `_links.next.href`.
- otherwise → JSON-envelope parser: members come from `entities`;
  `nextCursor` comes from `body.nextCursor`.

## Parameters

### opts

[`FetchSeedRecordPageOptions`](../interfaces/FetchSeedRecordPageOptions.md)

## Returns

`Promise`\<`SeedRecordPage`\>
