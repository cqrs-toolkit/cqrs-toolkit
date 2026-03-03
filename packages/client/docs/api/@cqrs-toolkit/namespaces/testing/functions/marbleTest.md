[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../README.md) / [testing](../README.md) / marbleTest

# Function: marbleTest()

> **marbleTest**(`fn`): () => `void`

Defined in: packages/client/src/testing/marbleTest.ts:24

Create a marble test function.
Uses vitest's assert.deepEqual for comparison.

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
