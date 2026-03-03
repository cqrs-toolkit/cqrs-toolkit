/**
 * Marble testing helper for RxJS.
 * Provides a convenient wrapper for TestScheduler.
 */

import assert from 'node:assert'
import { RunHelpers, TestScheduler } from 'rxjs/testing'

/**
 * Create a marble test function.
 * Uses node:assert's deepStrictEqual for comparison.
 *
 * @param fn - Test function that receives RunHelpers
 * @returns Function to be used as test body
 *
 * @example
 * ```ts
 * it('emits values', marbleTest(({ cold, expectObservable }) => {
 *   const source$ = cold('a-b-c|', { a: 1, b: 2, c: 3 });
 *   expectObservable(source$).toBe('a-b-c|', { a: 1, b: 2, c: 3 });
 * }));
 * ```
 */
export function marbleTest(fn: (helpers: RunHelpers) => void): () => void {
  return () => {
    const testScheduler = new TestScheduler((actual, expected) =>
      assert.deepEqual(actual, expected),
    )
    testScheduler.run((helpers) => fn(helpers))
  }
}
