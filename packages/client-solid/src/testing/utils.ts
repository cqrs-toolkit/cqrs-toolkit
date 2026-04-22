import { CqrsClient, type EnqueueCommand, type LibraryEvent } from '@cqrs-toolkit/client'
import { formatEventBusTimeline } from '@cqrs-toolkit/client/fixtures'
import {
  testEventBusLogger,
  type IntegrationBootstrapConfig,
  type IntegrationContext,
} from '@cqrs-toolkit/client/testing'
import { type ServiceLink } from '@meticoeus/ddd-es'
import { type Subscription } from 'rxjs'
import { createRoot, getOwner, runWithOwner, type Owner } from 'solid-js'
import { CqrsContext } from '../context.js'

export type TClient = CqrsClient<ServiceLink, EnqueueCommand>

/**
 * Default internal timeout enforced by {@link createRun}. Mirrors the value
 * used by the client integration harness so failures dump the EventBus
 * timeline before vitest's outer timeout fires.
 */
const DEFAULT_INTEGRATION_RUN_TIMEOUT_MS = 5000

/**
 * Test context passed to a {@link createRun} callback. Spreads the underlying
 * {@link IntegrationContext} and exposes the Solid root's `dispose` so tests
 * can tear down the reactive graph deterministically (or rely on the
 * harness's `finally` cleanup).
 */
export interface SolidTestContext extends IntegrationContext {
  dispose(): void
  /**
   * Run a function inside the Solid {@link createRoot}'s owner context. Use
   * this when calling Solid primitives (`createSignal`, `useContext`, the
   * `createXxxQuery` helpers) after an `await` in the test body — `await`
   * loses the synchronous owner, so a bare call would fail with
   * `useClient must be used within a CqrsProvider`.
   *
   * Bare reads of reactive state (e.g., `state.items`) and bare async work
   * against the underlying {@link IntegrationContext} do not need the wrapper.
   */
  runInOwner<T>(fn: () => T): T
}

export function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0))
}

export async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`waitFor timed out after ${timeoutMs}ms`)
    }
    await tick()
  }
}

/**
 * Create a Solid-aware integration test runner.
 *
 * Mirrors `createRun` from `@cqrs-toolkit/client/testing` but additionally:
 * - Enters a Solid {@link createRoot} and seeds the {@link CqrsContext} value
 *   directly on the root's owner. We deliberately do NOT use `<CqrsProvider>`
 *   in the test harness — Solid's built-in Provider component owns its
 *   children via an internal `createRenderEffect` whose body re-evaluates in
 *   some scenarios (notably when reactive primitives created during its
 *   children scope's first render produce side effects through async
 *   observable chains). Each re-evaluation cleans up the children memo,
 *   which would dispose the test's `createListQuery` / `createScopeCacheKey`
 *   computations mid-test and silently break their reactivity. Setting the
 *   context directly on a stable `createRoot` owner gives the test
 *   computations a lifetime tied to the test, not to the Provider's render
 *   cycle.
 * - Disposes the Solid root in `finally` even when the test times out, so a
 *   stuck reactive graph never leaks across tests.
 *
 * Behaviour mirrored from the client harness:
 * - Subscribes to `eventBus.events$` with `eventBus.debug = true` and dumps a
 *   formatted timeline to stderr on test failure.
 * - Races the test callback against an internal timeout (default 5s, override
 *   via `config.timeoutMs`). Pair with `integrationTestOptions` from
 *   `@cqrs-toolkit/client/testing` so vitest's outer timeout is longer than
 *   the internal one — otherwise vitest fires first and the timeline is lost.
 */
export function createRun(
  bootstrap: (config?: IntegrationBootstrapConfig) => Promise<IntegrationContext>,
) {
  return function run(
    config: IntegrationBootstrapConfig,
    cb: (ctx: SolidTestContext) => Promise<void>,
  ): () => Promise<void> {
    return async () => {
      const ctx = await bootstrap(config)

      ctx.eventBus.debug = true
      const eventLog: LibraryEvent<ServiceLink>[] = []
      const eventSub: Subscription = ctx.eventBus.events$.subscribe((event) => {
        eventLog.push(event)
      })

      // Route logProvider through this run's bus so log lines interleave
      // with library events in the timeline. Cleared in `finally` so a
      // completed bus from this test can never receive emissions.
      testEventBusLogger.setSink(ctx.eventBus)

      let solidDispose: (() => void) | undefined

      // Set up the test's Solid root and CqrsContext. We DON'T use
      // `<CqrsProvider>` here because Solid's built-in Provider component
      // owns its children via an internal createRenderEffect that re-runs in
      // some scenarios (notably when reactive primitives created inside its
      // children scope cause re-evaluation). Each re-run cleans up its
      // children memo — which would dispose the test's createListQuery /
      // createScopeCacheKey computations mid-test, breaking reactivity.
      //
      // Instead we set the context value directly on the createRoot's owner.
      // Computations created via `runInOwner(fn)` inherit `owner.context` at
      // creation time, so `useClient()` resolves correctly. The owner lives
      // for the entire test (only disposed in `finally`), so test
      // computations are stable.
      const testRun = new Promise<void>((resolve, reject) => {
        createRoot((dispose) => {
          solidDispose = dispose
          const owner = getOwner()
          if (owner === null) {
            reject(new Error('createRun: getOwner() returned null inside createRoot'))
            return
          }
          // Inject CqrsContext on this owner so child computations see it.
          owner.context = {
            ...(owner.context ?? {}),
            [CqrsContext.id]: ctx.client as unknown as TClient,
          }
          const runInOwner = makeRunInOwner(owner)
          cb({ ...ctx, dispose, runInOwner }).then(resolve, reject)
        })
      })

      const timeoutMs = config.timeoutMs ?? DEFAULT_INTEGRATION_RUN_TIMEOUT_MS
      let timeoutId: ReturnType<typeof setTimeout> | undefined
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(`Integration test exceeded ${timeoutMs}ms internal timeout`)),
          timeoutMs,
        )
      })

      try {
        await Promise.race([testRun, timeoutPromise])
      } catch (err) {
        // eslint-disable-next-line no-console -- dumping event timeline on
        // integration test failure is more useful than the bare assertion
        console.error(formatEventBusTimeline(eventLog))
        throw err
      } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId)
        eventSub.unsubscribe()
        testEventBusLogger.setSink(undefined)
        solidDispose?.()
        await ctx.destroy()
      }
    }
  }
}

function makeRunInOwner(owner: Owner | null): SolidTestContext['runInOwner'] {
  return function runInOwner<T>(fn: () => T): T {
    if (owner === null) {
      throw new Error('createRun: owner was not captured during Solid root setup')
    }
    // Solid's runWithOwner returns the function's value, but its declared
    // signature is `<T>(...): T | undefined` because it short-circuits to
    // undefined when the owner has been disposed. Tests that reach here
    // expect a live owner, so the explicit cast is the least-bad option.
    return runWithOwner(owner, fn) as T
  }
}
