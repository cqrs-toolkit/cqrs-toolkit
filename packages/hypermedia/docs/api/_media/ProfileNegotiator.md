[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [server](../README.md) / ProfileNegotiator

# Class: ProfileNegotiator\<S\>

Result-based profile negotiator.

Parses Content-Profile / Accept-Profile headers (via `deriveRequestedProfilesRaw`),
matches against registered specs, and sends 406 when no spec matches.

`varyTokens` controls which Vary tokens are emitted — the read side uses
`Accept, Accept-Profile` while the write side uses `Content-Type, Content-Profile`.

## Type Parameters

### S

`S` _extends_ [`ProfileSpec`](../interfaces/ProfileSpec.md)

## Constructors

### Constructor

> **new ProfileNegotiator**\<`S`\>(`specs`, `opts`): `ProfileNegotiator`\<`S`\>

#### Parameters

##### specs

`S`[]

##### opts

###### varyTokens

`string`[]

#### Returns

`ProfileNegotiator`\<`S`\>

## Properties

### latest

> `readonly` **latest**: `S`

---

### supported

> `readonly` **supported**: `string`[]

## Methods

### applyHeaders()

> **applyHeaders**(`reply`, `urn`): `void`

Set Content-Profile, Link, and Vary headers using the constructor-provided tokens.

#### Parameters

##### reply

`FastifyReply`

##### urn

`string`

#### Returns

`void`

---

### get()

> **get**(`urn`): `S` \| `undefined`

Look up a spec by URN.

#### Parameters

##### urn

`string`

#### Returns

`S` \| `undefined`

---

### negotiate()

> **negotiate**(`request`, `reply`): [`NegotiateResult`](../type-aliases/NegotiateResult.md)\<`S`\>

Match request headers against registered specs.
Sends 406 reply directly when unsupported.

Returns:
{ kind: 'replied' } — 406 sent, caller should return early
{ kind: 'matched', spec } — exact URN match
{ kind: 'none' } — no preference expressed by client

#### Parameters

##### request

[`ReqLike`](../../index/interfaces/ReqLike.md)

##### reply

`FastifyReply`

#### Returns

[`NegotiateResult`](../type-aliases/NegotiateResult.md)\<`S`\>

---

### appendVary()

> `static` **appendVary**(`reply`, ...`tokens`): `void`

#### Parameters

##### reply

`FastifyReply`

##### tokens

...`string`[]

#### Returns

`void`
