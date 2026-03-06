[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [testing](../README.md) / marbleTest

# Function: marbleTest()

> **marbleTest**(`fn`): () => `void`

Defined in: [packages/client/src/testing/marbleTest.ts:24](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/testing/marbleTest.ts#L24)

Create a marble test function.
Uses node:assert's deepStrictEqual for comparison.

## Parameters

### fn

(`helpers`) => `void`

Test function that receives RunHelpers

## Returns

Function to be used as test body

> (): `void`

### Returns

`void`

## Example

```ts
it(
  'emits values',
  marbleTest(({ cold, expectObservable }) => {
    const source$ = cold('a-b-c|', { a: 1, b: 2, c: 3 })
    expectObservable(source$).toBe('a-b-c|', { a: 1, b: 2, c: 3 })
  }),
)
```
