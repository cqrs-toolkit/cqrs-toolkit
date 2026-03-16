[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [server](../README.md) / ProfileHandler

# Class: ProfileHandler\<UseResolve, Locals, Context, Request\>

Result-based profile handler for query endpoints.

Composes a ProfileNegotiator for Accept-Profile header negotiation.
On success, sends the response with proper Content-Profile/Vary headers.
On negotiation failure (406), sends the error response directly.
Resolver errors are propagated to the caller via the Result Err channel
for centralized upstream handling.

## Type Parameters

### UseResolve

`UseResolve` _extends_ `boolean`

### Locals

`Locals`

### Context

`Context`

### Request

`Request` _extends_ [`Request`](../namespaces/Hypermedia/interfaces/Request.md) = [`Request`](../namespaces/Hypermedia/interfaces/Request.md)

## Constructors

### Constructor

> **new ProfileHandler**\<`UseResolve`, `Locals`, `Context`, `Request`\>(`opts`): `ProfileHandler`\<`UseResolve`, `Locals`, `Context`, `Request`\>

#### Parameters

##### opts

###### representations

[`RepresentationProfile`](../type-aliases/RepresentationProfile.md)\<`Locals`, `Context`, `Request`, `UseResolve`\>[]

#### Returns

`ProfileHandler`\<`UseResolve`, `Locals`, `Context`, `Request`\>

## Methods

### applyHeaders()

> **applyHeaders**(`reply`, `urn`): `void`

Apply success headers ONLY after you have the response ready.

#### Parameters

##### reply

`FastifyReply`

##### urn

`string`

#### Returns

`void`

---

### getRequestedProfile()

> **getRequestedProfile**(`request`, `reply`): [`RepliedValue`](../interfaces/RepliedValue.md) \| [`NegotiatedProfile`](../interfaces/NegotiatedProfile.md)\<`Locals`, `Context`, `Request`, `UseResolve`\>

Negotiate the profile.

Returns:
`{ kind: 'replied' }` — 406 sent, caller should return early
`{ kind: 'negotiated' }` — profile matched (or default), ready to resolve

#### Parameters

##### request

[`ReqLike`](../../index/interfaces/ReqLike.md)

##### reply

`FastifyReply`

#### Returns

[`RepliedValue`](../interfaces/RepliedValue.md) \| [`NegotiatedProfile`](../interfaces/NegotiatedProfile.md)\<`Locals`, `Context`, `Request`, `UseResolve`\>

---

### resolve()

> **resolve**(`request`, `reply`, `locals`, `context`): `Promise`\<`Result`\<[`RepliedValue`](../interfaces/RepliedValue.md), `IException`\<`unknown`\>\>\>

Negotiate profile, resolve, send response.

On success or 406, sends the reply and returns `Ok({ kind: 'replied' })`.
On resolver error, propagates via `Err` for centralized upstream handling.

#### Parameters

##### request

`Request`

##### reply

`FastifyReply`

##### locals

`Locals`

##### context

`Context`

#### Returns

`Promise`\<`Result`\<[`RepliedValue`](../interfaces/RepliedValue.md), `IException`\<`unknown`\>\>\>
