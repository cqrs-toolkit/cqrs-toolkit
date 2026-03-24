[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [testing](../README.md) / marbleTest

# Function: marbleTest()

> **marbleTest**(`fn`): () => `void`

Create a marble test function.
Provides a convenient wrapper for TestScheduler.

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
