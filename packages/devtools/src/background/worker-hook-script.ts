/**
 * Worker-side hook installer.
 *
 * Compiled to a self-contained IIFE that the extension sends to a worker
 * target via CDP `Runtime.evaluate`. Inside the worker it installs:
 *
 *   - `self.__CQRS_TOOLKIT_DEVTOOLS__.recordNetEvent(event)` — the public
 *     surface library/user code calls to report network observations. The
 *     installed function pipes the event JSON through the
 *     `__cqrsDevtoolsBinding` function that the extension added via
 *     `Runtime.addBinding` (one binding per debugger session; re-attaching
 *     re-routes events to the new listener with the same binding name).
 *
 * That's it.
 *
 * The previous version of this script also monkey-patched
 * `globalThis.WebSocket` to auto-cover any WS the library or user code
 * opened. That patch had too many silent failure modes — built-in
 * WebSocket subclassing has edge cases in worker contexts, exceptions in
 * the constructor surfaced as zero frames with no banner, and the
 * pre-existing CQRS WS in a long-lived SharedWorker was never wrapped
 * regardless. The library hook (`recordNetEvent` / `wrapWebSocket` in
 * toolkit code) is the canonical opt-in path; we no longer fight built-in
 * `WebSocket` semantics.
 *
 * Status shape returned by `Runtime.evaluate({ returnByValue: true })`:
 *   - { status: 'installed',          version: 1 } — fresh install.
 *   - { status: 'already-installed',  version: 1 } — sentinel matched.
 *   - { status: 'failed',             error: string } — install threw
 *     internally (caught at the script level so the caller sees a typed
 *     result rather than a CDP exception).
 *
 *
 * Forward-migration contract:
 *
 *   The hook surface and sentinel name are part of the public contract
 *   between the extension and any consumer code that reads
 *   `self.__CQRS_TOOLKIT_DEVTOOLS__`. If a future version of this script
 *   changes the surface (new methods, signature changes), it MUST detect
 *   prior-version sentinels and either coexist or replace cleanly so
 *   long-running workers carrying an older install don't end up in a
 *   half-upgraded state.  At v1 there is no prior version; this branch
 *   grows with each bump.
 */

export const HOOK_VERSION = 1
export const SENTINEL_KEY = `__cqrsToolkitHookInstalled_v${HOOK_VERSION}__`
export const BINDING_NAME = '__cqrsDevtoolsBinding'
export const DEVTOOLS_GLOBAL = '__CQRS_TOOLKIT_DEVTOOLS__'

/**
 * IIFE source for `Runtime.evaluate`. Self-contained — no closure captures
 * from outside this template literal apply; constants are baked into the
 * string at module-load time so the script the worker sees has them inline.
 */
export const WORKER_HOOK_SCRIPT = `(() => {
  try {
    const SENTINEL = '${SENTINEL_KEY}';
    const BINDING = '${BINDING_NAME}';
    const DEVTOOLS_GLOBAL = '${DEVTOOLS_GLOBAL}';
    const g = globalThis;

    function bindingCall(payload) {
      try {
        const fn = g[BINDING];
        if (typeof fn === 'function') fn(JSON.stringify(payload));
      } catch (_e) {
        // Binding not present (extension detached) — drop silently.
      }
    }

    // Install (or refresh) the hook surface. Idempotent — re-running just
    // reassigns recordNetEvent to a fresh closure over the (possibly
    // re-bound) binding function.
    if (!g[DEVTOOLS_GLOBAL] || typeof g[DEVTOOLS_GLOBAL] !== 'object') {
      g[DEVTOOLS_GLOBAL] = {};
    }
    g[DEVTOOLS_GLOBAL].recordNetEvent = function recordNetEvent(event) {
      bindingCall(event);
    };

    if (g[SENTINEL] === true) {
      // Refreshed binding routing; existing libraries continue to work.
      return { status: 'already-installed', version: ${HOOK_VERSION} };
    }
    Object.defineProperty(g, SENTINEL, {
      value: true,
      enumerable: false,
      writable: false,
      configurable: true,
    });

    return { status: 'installed', version: ${HOOK_VERSION} };
  } catch (err) {
    return {
      status: 'failed',
      error: (err && err.message) ? String(err.message) : String(err),
    };
  }
})()`

export type WorkerHookStatus =
  | { status: 'installed'; version: number }
  | { status: 'already-installed'; version: number }
  | { status: 'failed'; error: string }

/** Type guard for the `Runtime.evaluate` result value. */
export function parseHookStatus(value: unknown): WorkerHookStatus | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const rec = value as Record<string, unknown>
  const status = rec['status']
  if (status === 'installed' || status === 'already-installed') {
    const version = typeof rec['version'] === 'number' ? rec['version'] : HOOK_VERSION
    return { status, version }
  }
  if (status === 'failed') {
    const error = typeof rec['error'] === 'string' ? rec['error'] : 'unknown'
    return { status: 'failed', error }
  }
  return undefined
}
