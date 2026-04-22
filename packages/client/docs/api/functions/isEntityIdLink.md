[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / isEntityIdLink

# Function: isEntityIdLink()

> **isEntityIdLink**\<`TLink`\>(`value`): `value is EntityTLink<TLink>`

Type guard for Link-shaped objects whose `id` may be an EntityId.

Matches `{ type: string, id: EntityId }` with optional `service: string`.
Distinct from the server-side `Link` from `@meticoeus/ddd-es` — the `id`
field allows EntityRef values because anticipated events carry EntityRefs
before reconciliation.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

## Parameters

### value

`unknown`

## Returns

`value is EntityTLink<TLink>`
