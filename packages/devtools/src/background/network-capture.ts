/**
 * chrome.debugger-driven worker network capture for the devtools probe.
 *
 * The panel lives inside DevTools, which already holds the inspected tab's
 * debugger client — so chrome.debugger.attach({ tabId }) would conflict and
 * fail with "Not allowed". Instead, we attach directly to same-origin
 * worker targets by targetId (DevTools does not claim those automatically).
 * SharedWorker and dedicated-worker modes both flow through this path.
 *
 * Division of labor between this module and the library hook path:
 *
 *   - **HTTP** flows through CDP `Network.*` here (Network.requestWillBeSent,
 *     responseReceived, loadingFinished/Failed, plus Network.getResponseBody
 *     on finish). Page HTTP is captured separately in the panel context via
 *     `chrome.devtools.network.onRequestFinished`.
 *   - **WebSocket** events are owned entirely by the library/patch hook
 *     path:
 *       * `wrapWebSocket` in toolkit/user code (always carries url),
 *       * the CDP-injected worker patch installed here on each session
 *         (replaces `globalThis.WebSocket` with a wrapper; reports via
 *         `__cqrsDevtoolsBinding`),
 *       * user `recordNetEvent` calls.
 *     CDP-native `Network.webSocket*` events are deliberately dropped at
 *     projection time — they lacked url for pre-existing connections (no
 *     paired `webSocketCreated`) and produced duplicate rows alongside the
 *     library path. Routing WS exclusively through the hook gives one row
 *     per frame, always with url, and auto-filters Vite HMR noise.
 *
 * On each attached worker we enable Network (HTTP) and Runtime (binding +
 * evaluate), install the worker hook patch, and setAutoAttach in flat mode
 * so dedicated children spawned by that worker (sqlite-worker, opfs-proxy)
 * surface as child sessions under the same attachment.
 *
 * Workers spawned by the page after capture starts don't auto-attach (we
 * have no setAutoAttach on the page session), so we re-enumerate targets
 * on a low-frequency timer while capturing and attach to any newly-seen
 * same-origin worker.
 *
 * One global instance owns the chrome.debugger.onEvent + onDetach listeners;
 * per-tab state lives in CaptureSession entries keyed by tabId. A single
 * capture can own multiple top-level attachments (one per matching worker).
 */

import type {
  ClientMode,
  NetCaptureState,
  NetEventLoadingFailed,
  NetEventLoadingFinished,
  NetEventRequestWillBeSent,
  NetEventResponseBody,
  NetEventResponseReceived,
  NetEventTargetAttached,
  NetEventTargetDetached,
  NetEventWebSocketClosed,
  NetEventWebSocketCreated,
  NetEventWebSocketFrame,
  NetSessionInfo,
  NetworkProbeEvent,
} from '../shared/protocol.js'
import {
  BINDING_NAME,
  WORKER_HOOK_SCRIPT,
  parseHookStatus,
  type WorkerHookStatus,
} from './worker-hook-script.js'

/** Max bytes retained for request body previews forwarded to the panel. */
const PAYLOAD_PREVIEW_BYTES = 1024

/** Max bytes of an HTTP response body to forward to the panel. Anything over
 *  this is clipped + flagged truncated so chrome.runtime messages stay small. */
const RESPONSE_BODY_LIMIT = 100_000

/** Interval for re-enumerating debugger targets to find workers spawned
 *  after capture started. Page-spawned dedicated workers don't auto-attach
 *  since we have no setAutoAttach on the page session. */
const RE_ENUMERATE_INTERVAL_MS = 2000

/** Resource types we skip for getResponseBody — known-binary, no point. */
const BODY_SKIP_TYPES: ReadonlySet<string> = new Set([
  'Image',
  'Media',
  'Font',
  'WebSocket',
  'Manifest',
  'Ping',
])

export type NetEventHandler = (event: NetworkProbeEvent) => void
export type NetStateHandler = (state: NetCaptureState) => void

interface RequestSource {
  /** Debuggee shape used to call Network.getResponseBody for this request. */
  debuggee: chrome.debugger.DebuggerSession
  /** CDP resourceType (e.g. 'Fetch', 'Image') — used to skip binary fetches. */
  resourceType: string | undefined
  session: NetSessionInfo
}

interface CaptureSession {
  tabId: number
  /** Origin of the inspected page; used to filter worker targets. */
  origin: string
  /**
   * Routing key → session info.
   *  - Top-level attachments (chrome.debugger.attach by targetId): keyed by targetId.
   *  - Flat-mode child sessions (Target.attachedToTarget under a top-level):
   *    keyed by sessionId.
   */
  sessions: Map<string, NetSessionInfo>
  /** targetIds for which chrome.debugger.attach succeeded. */
  attachedTopLevelTargets: Set<string>
  /**
   * Top-level targetIds whose HTTP is already covered by the panel-side
   * HAR pipe (`chrome.devtools.network.onRequestFinished`). For these
   * (dedicated workers spawned by the inspected page, and their flat-mode
   * child workers), we skip `Network.enable` on the CDP session to avoid
   * the same request showing up as two rows — once from HAR, once from
   * CDP. SharedWorker stays CDP-only since HAR can't see its process.
   */
  harCoveredTopLevels: Set<string>
  /** recordId → source debuggee + resourceType, used by getResponseBody on finish. */
  requestSources: Map<string, RequestSource>
  /** Timer handle for periodic getTargets() re-enumeration while capturing. */
  reEnumerateTimer?: ReturnType<typeof setInterval>
  /** Client mode for the session — drives target filtering in `reEnumerate`. */
  mode: ClientMode
  onEvent: NetEventHandler
  onState: NetStateHandler
}

export class NetworkCaptureManager {
  private readonly captures = new Map<number, CaptureSession>()
  /** Reverse index from a top-level targetId back to its owning tabId, so
   *  chrome.debugger.onEvent (which lacks tabId for targetId-attached
   *  debuggees) can still be routed. */
  private readonly targetToTab = new Map<string, number>()
  private listenersAttached = false

  /**
   * Begin capture for the given tab. Idempotent — calling again rebinds the
   * handlers but does not re-attach. Behaviour branches on `mode`:
   *
   *   - `'online-only'`: no debugger attach. Everything lives on the page;
   *     the page hook IIFE already routes library `recordNetEvent` calls
   *     to the panel, and HAR covers HTTP. Capture just flips state to
   *     `'capturing'`.
   *   - `'dedicated-worker'`: attach to same-origin dedicated workers
   *     (Brave reports them as `'other'`, Chrome as `'worker'`) for hook
   *     injection. `Network.enable` is skipped — HAR covers HTTP since
   *     the workers live in the inspected-page process.
   *   - `'shared-worker'`: attach to the SharedWorker for hook injection
   *     and `Network.enable` (HAR can't reach the SW process).
   *
   * `mode` undefined means the client hasn't registered yet — surface an
   * error rather than guessing.
   */
  async start(
    tabId: number,
    origin: string,
    mode: ClientMode | undefined,
    onEvent: NetEventHandler,
    onState: NetStateHandler,
  ): Promise<void> {
    this.attachListenersOnce()

    const existing = this.captures.get(tabId)
    if (existing) {
      existing.onEvent = onEvent
      existing.onState = onState
      onState({ status: 'capturing' })
      return
    }

    if (!mode) {
      onState({
        status: 'error',
        reason: 'Client mode unknown — wait for the CQRS client to register, then retry capture.',
      })
      return
    }

    const session: CaptureSession = {
      tabId,
      origin,
      sessions: new Map(),
      attachedTopLevelTargets: new Set(),
      harCoveredTopLevels: new Set(),
      requestSources: new Map(),
      mode,
      onEvent,
      onState,
    }
    this.captures.set(tabId, session)

    // Online-only mode never needs the debugger — page hook + HAR cover
    // everything. Skip the whole attach dance.
    if (mode === 'online-only') {
      onState({ status: 'capturing' })
      return
    }

    onState({ status: 'attaching' })

    try {
      const targets = await chrome.debugger.getTargets()
      const matches = selectWorkerTargetsForMode(targets, origin, mode)

      if (matches.length === 0) {
        const sameOriginTargets = targets
          .filter((t) => !origin || safeOrigin(t.url ?? '') === origin)
          .map((t) => `${t.type}@${t.url || '(no url)'}`)
          .join(' | ')
        onState({
          status: 'error',
          reason: `No ${mode === 'shared-worker' ? 'SharedWorker' : 'dedicated worker'} matched origin=${origin || '(unknown)'}. Same-origin targets: ${sameOriginTargets || '(none)'}`,
        })
        this.captures.delete(tabId)
        return
      }

      for (const target of matches) {
        await this.attachTopLevel(session, target)
      }

      this.startReEnumeration(session)
      onState({ status: 'capturing' })
    } catch (err) {
      this.captures.delete(tabId)
      const reason = errorMessage(err)
      // Recognise the specific "another debugger is already attached" case so
      // the panel can surface a clearer multi-instance message instead of a
      // raw CDP error string.
      if (/Another debugger is already attached/i.test(reason)) {
        onState({ status: 'conflict', reason })
      } else {
        onState({ status: 'error', reason })
      }
    }
  }

  /** End capture for the given tab. Detaches every owned top-level target. */
  async stop(tabId: number): Promise<void> {
    const session = this.captures.get(tabId)
    if (!session) return
    this.captures.delete(tabId)
    this.stopReEnumeration(session)
    for (const targetId of session.attachedTopLevelTargets) {
      this.targetToTab.delete(targetId)
      try {
        await chrome.debugger.detach({ targetId })
      } catch {
        // Target already gone, user cancelled, etc. — fine.
      }
    }
    session.onState({ status: 'idle' })
  }

  /** Clean up if the inspected tab goes away. */
  dropTab(tabId: number): void {
    const session = this.captures.get(tabId)
    if (!session) return
    this.captures.delete(tabId)
    this.stopReEnumeration(session)
    for (const targetId of session.attachedTopLevelTargets) {
      this.targetToTab.delete(targetId)
    }
  }

  private startReEnumeration(session: CaptureSession): void {
    if (session.reEnumerateTimer !== undefined) return
    session.reEnumerateTimer = setInterval(() => {
      void this.reEnumerate(session)
    }, RE_ENUMERATE_INTERVAL_MS)
  }

  private stopReEnumeration(session: CaptureSession): void {
    if (session.reEnumerateTimer === undefined) return
    clearInterval(session.reEnumerateTimer)
    session.reEnumerateTimer = undefined
  }

  /**
   * Poll for newly-spawned same-origin worker targets and attach to any
   * that we don't already track. Page-spawned dedicated workers in
   * dedicated-worker mode arrive this way — they have no SharedWorker
   * parent under which `setAutoAttach` would pick them up.
   */
  private async reEnumerate(session: CaptureSession): Promise<void> {
    if (!this.captures.has(session.tabId)) return
    let targets: chrome.debugger.TargetInfo[]
    try {
      targets = await chrome.debugger.getTargets()
    } catch {
      return
    }
    const candidates = selectWorkerTargetsForMode(targets, session.origin, session.mode)
    for (const target of candidates) {
      if (session.attachedTopLevelTargets.has(target.id)) continue
      try {
        await this.attachTopLevel(session, target)
      } catch {
        // Race: target detached or another debugger claimed it between
        // the enumeration and the attach. Skip; the next tick may retry.
      }
    }
  }

  private async attachTopLevel(
    session: CaptureSession,
    target: chrome.debugger.TargetInfo,
  ): Promise<void> {
    const targetId = target.id
    const debuggee = { targetId }

    await chrome.debugger.attach(debuggee, '1.3')
    session.attachedTopLevelTargets.add(targetId)
    this.targetToTab.set(targetId, session.tabId)

    // Use targetId as the routing key for the top-level (root) session.
    // Flat-mode child sessions get their own keys later (by sessionId).
    const url = target.url ?? ''
    const info: NetSessionInfo = {
      sessionId: targetId,
      targetType: classifyWorkerType(target.type, url),
      targetUrl: url,
      targetId,
    }
    session.sessions.set(targetId, info)

    // Synthetic target-attached event for the panel's targets banner; the
    // CDP Target.attachedToTarget event isn't emitted for the root of our
    // own attach, so we mint one here.
    const evt: NetEventTargetAttached = {
      kind: 'target-attached',
      session: info,
      cdpTimestamp: 0,
      wallTime: Date.now(),
      waitingForDebugger: false,
    }
    session.onEvent(evt)

    // HTTP source split:
    //   - SharedWorker lives in its own process; HAR can't see it; CDP is
    //     the sole HTTP source → enable Network.
    //   - Dedicated workers (and their flat-mode children) live in the
    //     inspected-page process; HAR already reports their HTTP via
    //     chrome.devtools.network.onRequestFinished; CDP would double up
    //     → skip Network. Attach is still needed so the hook installs and
    //     in-worker `wrapWebSocket` can route WS frames through us.
    const harCovered = info.targetType !== 'shared_worker'
    if (harCovered) session.harCoveredTopLevels.add(targetId)

    await chrome.debugger.sendCommand(debuggee, 'Runtime.enable', {})
    if (!harCovered) {
      await chrome.debugger.sendCommand(debuggee, 'Network.enable', {})
    }
    await this.installWorkerHook(debuggee, info, session)
    await chrome.debugger.sendCommand(debuggee, 'Target.setAutoAttach', {
      autoAttach: true,
      waitForDebuggerOnStart: true,
      flatten: true,
    })
  }

  /**
   * Install the WebSocket-instrumenting hook into a worker target via CDP
   * `Runtime.evaluate`. Idempotency, foreign-patch detection, and the
   * forward-migration contract live inside the script itself (per ADR 0001);
   * this method just runs the injection and surfaces the returned status.
   *
   * The binding is added before the script runs so the patch's first
   * `bindingCall` lands on the listener that's already routing to us.
   */
  private async installWorkerHook(
    debuggee: chrome.debugger.DebuggerSession,
    info: NetSessionInfo,
    capture: CaptureSession,
  ): Promise<void> {
    try {
      await chrome.debugger.sendCommand(debuggee, 'Runtime.addBinding', {
        name: BINDING_NAME,
      })
      const result = await chrome.debugger.sendCommand(debuggee, 'Runtime.evaluate', {
        expression: WORKER_HOOK_SCRIPT,
        returnByValue: true,
      })
      const evalResult = asRecord(result)
      // If the script threw before its own try/catch could fire (e.g. a
      // syntax error), Runtime.evaluate returns exceptionDetails. Surface
      // it — silent failure here is the bug we're fixing.
      const exception = asRecord(evalResult?.['exceptionDetails'])
      if (exception) {
        const text = readString(exception, 'text') ?? 'unknown error'
        const detail =
          readString(asRecord(exception['exception']), 'description') ??
          readString(asRecord(exception['exception']), 'value') ??
          ''
        capture.onState({
          status: 'error',
          reason: `Worker hook script threw on ${info.targetUrl || info.targetType}: ${text}${detail ? ' — ' + detail : ''}`,
        })
        return
      }
      const status = parseHookStatus(asRecord(evalResult?.['result'])?.['value'])
      if (!status) {
        capture.onState({
          status: 'error',
          reason: `Worker hook script returned no status on ${info.targetUrl || info.targetType} (unexpected — check console)`,
        })
        return
      }
      this.surfaceHookStatus(capture, info, status)
    } catch (err) {
      capture.onState({
        status: 'error',
        reason: `Worker hook injection failed for ${info.targetUrl || info.targetType}: ${errorMessage(err)}`,
      })
    }
  }

  private surfaceHookStatus(
    capture: CaptureSession,
    info: NetSessionInfo,
    status: WorkerHookStatus,
  ): void {
    if (status.status === 'failed') {
      capture.onState({
        status: 'error',
        reason: `Worker hook install failed on ${info.targetType}@${info.targetUrl}: ${status.error}`,
      })
    }
    // 'installed' / 'already-installed' are silent — failures already
    // surface as error banners, success doesn't need to. Earlier
    // success-probe banner was retained until we trusted the channel;
    // it's noise now.
  }

  private attachListenersOnce(): void {
    if (this.listenersAttached) return
    this.listenersAttached = true

    chrome.debugger.onEvent.addListener((source, method, params) => {
      const capture = this.findCapture(source)
      if (!capture) return
      this.handleCdpEvent(capture, source, method, params)
    })

    chrome.debugger.onDetach.addListener((source, reason) => {
      const capture = this.findCapture(source)
      if (!capture) return
      const targetId = source.targetId
      if (!targetId) return
      capture.attachedTopLevelTargets.delete(targetId)
      this.targetToTab.delete(targetId)
      // Only mark the whole capture detached when we've lost every attachment.
      if (capture.attachedTopLevelTargets.size === 0) {
        this.captures.delete(capture.tabId)
        capture.onState({ status: 'detached', reason })
      }
    })
  }

  private findCapture(source: chrome.debugger.DebuggerSession): CaptureSession | undefined {
    if (source.tabId !== undefined) {
      const direct = this.captures.get(source.tabId)
      if (direct) return direct
    }
    if (source.targetId !== undefined) {
      const tabId = this.targetToTab.get(source.targetId)
      if (tabId !== undefined) return this.captures.get(tabId)
    }
    return undefined
  }

  private handleCdpEvent(
    capture: CaptureSession,
    source: chrome.debugger.DebuggerSession,
    method: string,
    params: unknown,
  ): void {
    if (method === 'Target.attachedToTarget') {
      const parentTargetId = source.targetId
      if (!parentTargetId) return
      this.handleTargetAttached(capture, parentTargetId, params)
      return
    }
    if (method === 'Target.detachedFromTarget') {
      this.handleTargetDetached(capture, params)
      return
    }
    if (method === 'Runtime.bindingCalled') {
      this.handleBindingCalled(capture, source, params)
      return
    }

    if (!method.startsWith('Network.')) return

    // Resolve the session this event belongs to:
    //  - Flat-mode child events: source.sessionId set → keyed by sessionId.
    //  - Top-level events (root of an attach): source.sessionId undefined,
    //    source.targetId set → keyed by targetId (matches attachTopLevel).
    const sessionKey = source.sessionId ?? source.targetId ?? ''
    const sessionInfo = capture.sessions.get(sessionKey)
    if (!sessionInfo) return

    const probe = this.normaliseNetworkEvent(sessionInfo, method, params)
    if (!probe) return
    capture.onEvent(probe)

    // Track per-request source so we can later call Network.getResponseBody
    // on the same debuggee. Clean up on terminal events.
    if (probe.kind === 'request-will-be-sent') {
      capture.requestSources.set(probe.recordId, {
        debuggee: debuggeeFromSource(source),
        resourceType: probe.resourceType,
        session: sessionInfo,
      })
    } else if (probe.kind === 'loading-finished') {
      void this.fetchResponseBody(capture, probe.recordId, probe.requestId)
    } else if (probe.kind === 'loading-failed') {
      capture.requestSources.delete(probe.recordId)
    }
  }

  /**
   * After Network.loadingFinished, request the response body for the same
   * debuggee that produced the event. Quietly drop known-binary resource
   * types; cap forwarded body at RESPONSE_BODY_LIMIT to keep messages small.
   */
  private async fetchResponseBody(
    capture: CaptureSession,
    recordId: string,
    requestId: string,
  ): Promise<void> {
    const meta = capture.requestSources.get(recordId)
    if (!meta) return
    capture.requestSources.delete(recordId)
    if (meta.resourceType && BODY_SKIP_TYPES.has(meta.resourceType)) return

    try {
      const result = await chrome.debugger.sendCommand(meta.debuggee, 'Network.getResponseBody', {
        requestId,
      })
      const body = readString(result, 'body') ?? ''
      const base64Encoded = readBoolean(result, 'base64Encoded') ?? false
      const truncated = body.length > RESPONSE_BODY_LIMIT
      const clipped = truncated ? body.slice(0, RESPONSE_BODY_LIMIT) : body
      const evt: NetEventResponseBody = {
        kind: 'response-body',
        recordId,
        requestId,
        session: meta.session,
        cdpTimestamp: 0,
        wallTime: Date.now(),
        body: clipped,
        base64Encoded,
        truncated,
      }
      capture.onEvent(evt)
    } catch {
      // Buffer evicted, target detached, etc. Quietly drop — the request
      // record stays in the panel with whatever fields it did get.
    }
  }

  private handleTargetAttached(
    capture: CaptureSession,
    parentTargetId: string,
    params: unknown,
  ): void {
    const sessionId = readString(params, 'sessionId')
    const targetInfo = readObject(params, 'targetInfo')
    const waitingForDebugger = readBoolean(params, 'waitingForDebugger') ?? false
    if (!sessionId || !targetInfo) return

    const sessionInfo: NetSessionInfo = {
      sessionId,
      targetType: readString(targetInfo, 'type') ?? 'unknown',
      targetUrl: readString(targetInfo, 'url') ?? '',
      targetId: readString(targetInfo, 'targetId'),
    }
    capture.sessions.set(sessionId, sessionInfo)

    const evt: NetEventTargetAttached = {
      kind: 'target-attached',
      session: sessionInfo,
      cdpTimestamp: 0,
      wallTime: Date.now(),
      waitingForDebugger,
    }
    capture.onEvent(evt)

    // Subsequent commands on a flat-mode child session are routed via
    // { targetId: <our top-level>, sessionId }.
    const target = { targetId: parentTargetId, sessionId }
    // Child sessions inherit the parent's HAR coverage decision: if the
    // top-level was HAR-covered (dedicated-worker subtree), so is this
    // child — both live in the inspected-page process.
    const harCovered = capture.harCoveredTopLevels.has(parentTargetId)
    void (async () => {
      try {
        await chrome.debugger.sendCommand(target, 'Runtime.enable', {})
        if (!harCovered) {
          await chrome.debugger.sendCommand(target, 'Network.enable', {})
        }
        await this.installWorkerHook(target, sessionInfo, capture)
        await chrome.debugger.sendCommand(target, 'Target.setAutoAttach', {
          autoAttach: true,
          waitForDebuggerOnStart: true,
          flatten: true,
        })
        if (waitingForDebugger) {
          await chrome.debugger.sendCommand(target, 'Runtime.runIfWaitingForDebugger', {})
        }
      } catch (err) {
        capture.onState({
          status: 'error',
          reason: `child session (${sessionInfo.targetType}): ${errorMessage(err)}`,
        })
      }
    })()
  }

  /**
   * Route a `Runtime.bindingCalled` event from the injected worker hook
   * (per ADR 0001). The payload is a JSON-stringified `NetEventInput`;
   * we project it into the same `NetworkProbeEvent` shape the CDP Network
   * domain produces and emit through the regular `capture.onEvent` channel.
   */
  private handleBindingCalled(
    capture: CaptureSession,
    source: chrome.debugger.DebuggerSession,
    params: unknown,
  ): void {
    const name = readString(params, 'name')
    if (name !== BINDING_NAME) return
    const payloadJson = readString(params, 'payload')
    if (!payloadJson) return

    let input: unknown
    try {
      input = JSON.parse(payloadJson)
    } catch {
      return
    }
    const rec = asRecord(input)
    if (!rec) return
    const kind = rec['kind']
    if (typeof kind !== 'string') return
    const connectionId = readString(rec, 'connectionId')
    if (!connectionId) return

    const sessionKey = source.sessionId ?? source.targetId ?? ''
    const sessionInfo = capture.sessions.get(sessionKey)
    if (!sessionInfo) return

    const probe = projectBindingEvent(kind, connectionId, rec, sessionInfo)
    if (probe) capture.onEvent(probe)
  }

  private handleTargetDetached(capture: CaptureSession, params: unknown): void {
    const sessionId = readString(params, 'sessionId')
    if (!sessionId) return
    const sessionInfo = capture.sessions.get(sessionId)
    if (!sessionInfo) return
    capture.sessions.delete(sessionId)

    const evt: NetEventTargetDetached = {
      kind: 'target-detached',
      session: sessionInfo,
      cdpTimestamp: 0,
      wallTime: Date.now(),
    }
    capture.onEvent(evt)
  }

  private normaliseNetworkEvent(
    session: NetSessionInfo,
    method: string,
    params: unknown,
  ): NetworkProbeEvent | undefined {
    const requestId = readString(params, 'requestId')
    if (!requestId) return undefined

    const recordId = `${session.sessionId}:${requestId}`
    const cdpTimestamp = readNumber(params, 'timestamp') ?? 0
    const wallTime = Date.now()
    const base = { recordId, requestId, session, cdpTimestamp, wallTime }

    switch (method) {
      case 'Network.requestWillBeSent': {
        const request = readObject(params, 'request')
        if (!request) return undefined
        const initiator = readObject(params, 'initiator')
        const evt: NetEventRequestWillBeSent = {
          ...base,
          kind: 'request-will-be-sent',
          url: readString(request, 'url') ?? '',
          method: readString(request, 'method') ?? 'GET',
          headers: readStringMap(request, 'headers'),
          hasPostData: readBoolean(request, 'hasPostData') ?? false,
          postDataPreview: clipPreview(readString(request, 'postData')),
          resourceType: readString(params, 'type'),
          initiatorType: readString(initiator, 'type'),
          initiatorUrl: initiatorUrl(initiator),
        }
        return evt
      }

      case 'Network.responseReceived': {
        const response = readObject(params, 'response')
        if (!response) return undefined
        const evt: NetEventResponseReceived = {
          ...base,
          kind: 'response-received',
          url: readString(response, 'url') ?? '',
          status: readNumber(response, 'status') ?? 0,
          statusText: readString(response, 'statusText') ?? '',
          headers: readStringMap(response, 'headers'),
          mimeType: readString(response, 'mimeType') ?? '',
          resourceType: readString(params, 'type'),
          remoteIpAddress: readString(response, 'remoteIPAddress'),
          remotePort: readNumber(response, 'remotePort'),
          fromDiskCache: readBoolean(response, 'fromDiskCache'),
          fromServiceWorker: readBoolean(response, 'fromServiceWorker'),
          encodedDataLength: readNumber(response, 'encodedDataLength'),
          timing: readNumberMap(response, 'timing'),
        }
        return evt
      }

      case 'Network.loadingFinished': {
        const evt: NetEventLoadingFinished = {
          ...base,
          kind: 'loading-finished',
          encodedDataLength: readNumber(params, 'encodedDataLength') ?? 0,
        }
        return evt
      }

      case 'Network.loadingFailed': {
        const evt: NetEventLoadingFailed = {
          ...base,
          kind: 'loading-failed',
          resourceType: readString(params, 'type'),
          errorText: readString(params, 'errorText') ?? '',
          canceled: readBoolean(params, 'canceled'),
          blockedReason: readString(params, 'blockedReason'),
        }
        return evt
      }

      // CDP-native WebSocket events (Network.webSocketCreated / FrameSent /
      // FrameReceived / Closed) are deliberately dropped here. WS coverage
      // is owned entirely by the library/patch hook path:
      //   - `wrapWebSocket` in toolkit code (carries url on every frame)
      //   - The CDP-injected worker patch on `globalThis.WebSocket` (also
      //     carries url; covers new connections any worker code opens)
      //   - User-driven `recordNetEvent` calls
      // CDP-native frames lacked url for pre-existing connections (no
      // matching `webSocketCreated`) and produced duplicate rows alongside
      // the library path. Routing WS exclusively through the hook gives
      // one row per frame, always with url, and auto-filters Vite HMR
      // noise we never wanted in the panel. CDP is kept for HTTP only.
    }

    return undefined
  }
}

// ---------------------------------------------------------------------------
// Helpers — narrow unknown CDP payloads without `as` / `any`
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  return value as Record<string, unknown>
}

function readString(obj: unknown, key: string): string | undefined {
  const rec = asRecord(obj)
  if (!rec) return undefined
  const v = rec[key]
  return typeof v === 'string' ? v : undefined
}

function readNumber(obj: unknown, key: string): number | undefined {
  const rec = asRecord(obj)
  if (!rec) return undefined
  const v = rec[key]
  return typeof v === 'number' ? v : undefined
}

function readBoolean(obj: unknown, key: string): boolean | undefined {
  const rec = asRecord(obj)
  if (!rec) return undefined
  const v = rec[key]
  return typeof v === 'boolean' ? v : undefined
}

function readObject(obj: unknown, key: string): Record<string, unknown> | undefined {
  const rec = asRecord(obj)
  if (!rec) return undefined
  return asRecord(rec[key])
}

function readStringMap(obj: unknown, key: string): Record<string, string> {
  const rec = readObject(obj, key)
  const out: Record<string, string> = {}
  if (!rec) return out
  for (const k of Object.keys(rec)) {
    const v = rec[k]
    if (typeof v === 'string') out[k] = v
  }
  return out
}

function readNumberMap(obj: unknown, key: string): Record<string, number> | undefined {
  const rec = readObject(obj, key)
  if (!rec) return undefined
  const out: Record<string, number> = {}
  for (const k of Object.keys(rec)) {
    const v = rec[k]
    if (typeof v === 'number') out[k] = v
  }
  return out
}

function initiatorUrl(initiator: Record<string, unknown> | undefined): string | undefined {
  if (!initiator) return undefined
  const direct = readString(initiator, 'url')
  if (direct) return direct
  const stack = readObject(initiator, 'stack')
  if (!stack) return undefined
  const callFrames = stack['callFrames']
  if (Array.isArray(callFrames) && callFrames.length > 0) {
    return readString(callFrames[0], 'url')
  }
  return undefined
}

function clipPreview(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  if (value.length <= PAYLOAD_PREVIEW_BYTES) return value
  return value.slice(0, PAYLOAD_PREVIEW_BYTES)
}

/** UTF-8 byte length of a string (accurate beyond the char-count approximation). */
function utf8ByteLength(s: string): number {
  let bytes = 0
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c < 0x80) bytes += 1
    else if (c < 0x800) bytes += 2
    else if (c >= 0xd800 && c <= 0xdbff) {
      // High surrogate — pair contributes 4 bytes, skip the low half.
      bytes += 4
      i++
    } else bytes += 3
  }
  return bytes
}

function debuggeeFromSource(
  source: chrome.debugger.DebuggerSession,
): chrome.debugger.DebuggerSession {
  const targetId = source.targetId
  if (targetId === undefined) {
    // Tab-attached debuggees (we don't currently take this path) fall back
    // to tabId. Keep defensive in case the routing changes later.
    return { tabId: source.tabId }
  }
  if (source.sessionId !== undefined) {
    return { targetId, sessionId: source.sessionId }
  }
  return { targetId }
}

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}

/**
 * Project a worker-hook `NetEventInput`-shaped payload into the wire
 * `NetworkProbeEvent` shape. The page-side hook does an equivalent
 * projection locally before postMessage; we duplicate the logic here
 * rather than route page payloads through this projection because the
 * page hook can synthesize its own `NetSessionInfo` directly and the
 * extra round trip would be wasted.
 */
function projectBindingEvent(
  kind: string,
  connectionId: string,
  payload: Record<string, unknown>,
  session: NetSessionInfo,
): NetworkProbeEvent | undefined {
  const recordId = `library:${connectionId}`
  const base = {
    recordId,
    requestId: connectionId,
    session,
    cdpTimestamp: 0,
    wallTime: Date.now(),
  }

  if (kind === 'ws-created') {
    const url = readString(payload, 'url') ?? ''
    const evt: NetEventWebSocketCreated = { ...base, kind: 'ws-created', url }
    return evt
  }
  if (kind === 'ws-closed') {
    const evt: NetEventWebSocketClosed = { ...base, kind: 'ws-closed' }
    return evt
  }
  if (kind !== 'ws-frame-sent' && kind !== 'ws-frame-received') return undefined

  const url = readString(payload, 'url')
  const raw = payload['payload']
  if (typeof raw === 'string') {
    const preview = raw.length > PAYLOAD_PREVIEW_BYTES ? raw.slice(0, PAYLOAD_PREVIEW_BYTES) : raw
    const evt: NetEventWebSocketFrame = {
      ...base,
      kind,
      opcode: 1,
      mask: false,
      payloadSize: utf8ByteLength(raw),
      payloadPreview: preview,
      url,
    }
    return evt
  }

  const binRec = asRecord(raw)
  if (binRec && binRec['__binary__'] === true) {
    const byteLength = typeof binRec['byteLength'] === 'number' ? binRec['byteLength'] : 0
    const head = readString(binRec, 'head') ?? ''
    const evt: NetEventWebSocketFrame = {
      ...base,
      kind,
      opcode: 2,
      mask: false,
      payloadSize: byteLength,
      payloadPreview: formatBinaryPreviewFromBase64(head, byteLength),
      url,
    }
    return evt
  }
  return undefined
}

function formatBinaryPreviewFromBase64(head: string, byteLength: number): string {
  if (byteLength === 0) return '[binary]'
  let hexPeek = ''
  try {
    const bytes = atob(head.slice(0, 12))
    const chunks: string[] = []
    const cap = Math.min(bytes.length, 8)
    for (let i = 0; i < cap; i++) {
      chunks.push(bytes.charCodeAt(i).toString(16).padStart(2, '0'))
    }
    hexPeek = chunks.join(' ')
  } catch {
    // Malformed base64 — return without the peek rather than throw.
  }
  if (!hexPeek) return `[binary, ${byteLength} B]`
  return byteLength > 8
    ? `[binary, ${byteLength} B] ${hexPeek} …`
    : `[binary, ${byteLength} B] ${hexPeek}`
}

/** Vite-style worker URL signals — `?worker_file` query (modules and
 *  classic), or a `/worker(s)/` path segment. Used to identify workers
 *  among `'other'`-typed same-origin targets in browsers that don't
 *  report `'worker'` for dedicated workers. */
const WORKER_URL_PATTERN = /[?&]worker(_file)?(=|&|$)|\/workers?\//i

/**
 * Pick same-origin worker targets to attach to, scoped by the client's
 * declared mode. Browsers disagree on `TargetInfo.type`:
 *   - Chrome: `'shared_worker'` for SharedWorker, `'worker'` for dedicated.
 *   - Brave (and some Chromium builds): SharedWorker collapses to
 *     `'worker'`; dedicated workers come back as `'other'`.
 *
 * In `'shared-worker'` mode we accept SharedWorker-typed targets and
 * `'worker'`/`'other'` targets whose URL contains the `shared[-_]worker`
 * marker (the toolkit's worker-script naming convention). In
 * `'dedicated-worker'` mode we accept `'worker'` or `'other'` targets
 * with a Vite-style worker URL — that's how dedicated workers come
 * through on both Chrome and Brave. Online-only mode never lands here.
 */
function selectWorkerTargetsForMode(
  targets: chrome.debugger.TargetInfo[],
  origin: string,
  mode: ClientMode,
): chrome.debugger.TargetInfo[] {
  return targets.filter((t) => {
    const url = t.url ?? ''
    if (origin && safeOrigin(url) !== origin) return false
    const type: string = t.type
    if (mode === 'shared-worker') {
      if (type === 'shared_worker') return true
      // Brave reports SharedWorker as 'worker'; the toolkit's
      // worker-script path carries the 'shared-worker' marker.
      if ((type === 'worker' || type === 'other') && /shared[-_]worker/i.test(url)) return true
      return false
    }
    // dedicated-worker mode
    if (type === 'shared_worker') return false
    if (/shared[-_]worker/i.test(url)) return false
    if (type === 'worker') return true
    if (type === 'other' && WORKER_URL_PATTERN.test(url)) return true
    return false
  })
}

/**
 * Resolve the display label for a worker target. The toolkit's convention
 * puts SharedWorker scripts at a path containing 'shared-worker' (or
 * 'shared_worker'), so we promote those to `'shared_worker'` even on
 * browsers that report `'worker'` for both kinds. `'other'`-typed
 * workers identified by URL pattern are relabelled to `'worker'` so the
 * panel doesn't show "other@…" for what's really a dedicated worker.
 */
function classifyWorkerType(reportedType: string, url: string): string {
  if (reportedType === 'shared_worker' || /shared[-_]worker/i.test(url)) return 'shared_worker'
  if (reportedType === 'worker') return 'worker'
  if (reportedType === 'other' && WORKER_URL_PATTERN.test(url)) return 'worker'
  return reportedType
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return JSON.stringify(err)
}
