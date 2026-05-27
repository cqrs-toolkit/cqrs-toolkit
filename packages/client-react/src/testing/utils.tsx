import { CqrsClient, type EnqueueCommand, type LibraryEvent } from '@cqrs-toolkit/client'
import { formatEventBusTimeline } from '@cqrs-toolkit/client/fixtures'
import {
  testEventBusLogger,
  type IntegrationBootstrapConfig,
  type IntegrationContext,
} from '@cqrs-toolkit/client/testing'
import { type ServiceLink } from '@meticoeus/ddd-es'
import { renderHook as rtlRenderHook, type RenderHookResult } from '@testing-library/react'
import { type ReactNode } from 'react'
import { type Subscription } from 'rxjs'
import { CqrsProvider } from '../context.js'

export type TClient = CqrsClient<ServiceLink, EnqueueCommand>

/**
 * Default internal timeout enforced by {@link createRun}. Mirrors the value
 * used by the client integration harness so failures dump the EventBus
 * timeline before vitest's outer timeout fires.
 */
const DEFAULT_INTEGRATION_RUN_TIMEOUT_MS = 5000

/**
 * Result returned from the React harness's `renderHook` — testing-library's
 * shape, with the `unmount` exposed so tests can clean up early if desired.
 */
export type HookResult<T, Props = unknown> = RenderHookResult<T, Props>

/**
 * Test context passed to a {@link createRun} callback. Spreads the underlying
 * {@link IntegrationContext} and exposes a React-bound `renderHook` plus a
 * `dispose` for explicit teardown.
 */
export interface ReactTestContext extends IntegrationContext {
  /**
   * Render a hook inside a `<CqrsProvider>` rooted at the harness's client.
   * Returns the standard testing-library result; the harness tracks the
   * mount and unmounts it in `finally` even if the test throws.
   *
   * The second overload accepts a callback that takes props plus an
   * `initialProps` value, mirroring testing-library's API for rerender flows.
   */
  renderHook<T>(fn: () => T): HookResult<T>
  renderHook<T, Props>(fn: (props: Props) => T, initialProps: Props): HookResult<T, Props>
  /** Unmount everything the harness has mounted so far. Idempotent. */
  dispose(): void
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
 * Create a React-aware integration test runner.
 *
 * Mirrors `createRun` from `@cqrs-toolkit/client/testing` but additionally:
 * - Mounts every hook inside a `<CqrsProvider>` rooted at the harness's
 *   client, via testing-library's `renderHook`. The provider survives every
 *   `renderHook` call in the test body — re-mounts only happen when the
 *   test explicitly unmounts and re-renders.
 * - Unmounts every mounted hook in `finally`, including on timeout, so a
 *   stuck hook never leaks across tests.
 *
 * Behaviour mirrored from the client harness:
 * - Subscribes to `eventBus.events$` with `eventBus.debug = true` and dumps
 *   a formatted timeline to stderr on test failure.
 * - Races the test callback against an internal timeout (default 5s,
 *   override via `config.timeoutMs`). Pair with `integrationTestOptions`
 *   from `@cqrs-toolkit/client/testing` so vitest's outer timeout is longer
 *   than the internal one — otherwise vitest fires first and the timeline
 *   is lost.
 */
export function createRun(
  bootstrap: (config?: IntegrationBootstrapConfig) => Promise<IntegrationContext>,
) {
  return function run(
    config: IntegrationBootstrapConfig,
    cb: (ctx: ReactTestContext) => Promise<void>,
  ): () => Promise<void> {
    return async () => {
      const ctx = await bootstrap(config)

      ctx.eventBus.debug = true
      const eventLog: LibraryEvent<ServiceLink>[] = []
      const eventSub: Subscription = ctx.eventBus.events$.subscribe((event) => {
        eventLog.push(event)
      })

      testEventBusLogger.setSink(ctx.eventBus)

      const mounted: HookResult<unknown>[] = []
      let disposed = false

      const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
        <CqrsProvider client={ctx.client as TClient}>{children}</CqrsProvider>
      )

      const dispose = (): void => {
        if (disposed) return
        disposed = true
        for (const r of mounted) {
          try {
            r.unmount()
          } catch {
            // best-effort cleanup
          }
        }
        mounted.length = 0
      }

      function renderHook<T>(fn: () => T): HookResult<T>
      function renderHook<T, Props>(
        fn: (props: Props) => T,
        initialProps: Props,
      ): HookResult<T, Props>
      function renderHook(
        fn: (props: unknown) => unknown,
        initialProps?: unknown,
      ): HookResult<unknown, unknown> {
        const result = rtlRenderHook(fn, { wrapper, initialProps })
        mounted.push(result)
        return result
      }

      const reactCtx: ReactTestContext = { ...ctx, renderHook, dispose }

      const timeoutMs = config.timeoutMs ?? DEFAULT_INTEGRATION_RUN_TIMEOUT_MS
      let timeoutId: ReturnType<typeof setTimeout> | undefined
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(`Integration test exceeded ${timeoutMs}ms internal timeout`)),
          timeoutMs,
        )
      })

      try {
        await Promise.race([cb(reactCtx), timeoutPromise])
      } catch (err) {
        // eslint-disable-next-line no-console -- dumping the event timeline
        // on integration failure is more useful than the bare assertion
        console.error(formatEventBusTimeline(eventLog))
        throw err
      } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId)
        eventSub.unsubscribe()
        testEventBusLogger.setSink(undefined)
        dispose()
        await ctx.destroy()
      }
    }
  }
}
