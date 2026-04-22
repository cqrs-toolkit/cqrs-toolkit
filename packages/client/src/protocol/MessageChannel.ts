/**
 * Message channel for worker communication.
 *
 * Provides request/response correlation and event broadcasting
 * over Worker postMessage API.
 */

import { generateId } from '#utils'
import { logProvider } from '@meticoeus/ddd-es'
import { Observable, Subject, filter, firstValueFrom, take, timeout } from 'rxjs'
import type { IEventSink } from '../core/events/EventBus.js'
import type { LibraryEventData, LibraryEventType } from '../types/events.js'

/**
 * Error thrown when an RPC request to the worker fails.
 *
 * Carries the optional `errorCode` from the worker-side error so the
 * adapter layer can reconstruct typed exceptions (e.g., OpfsUnavailableException).
 */
export class RpcError extends Error {
  readonly errorCode: string | undefined

  constructor(message: string, errorCode?: string) {
    super(message)
    this.name = 'RpcError'
    this.errorCode = errorCode
  }
}

import type {
  EventMessage,
  HeartbeatMessage,
  RegisterWindowRequest,
  RegisterWindowResponse,
  RequestMessage,
  ResponseMessage,
  RestoreHoldsRequest,
  RestoreHoldsResponse,
  UnregisterWindowMessage,
  WorkerInstanceMessage,
  WorkerMessage,
} from './messages.js'
import { isEventMessage, isResponseMessage, isWorkerInstanceMessage } from './messages.js'
import { deserialize, serialize } from './serialization.js'

/**
 * Message channel configuration.
 */
export interface MessageChannelConfig {
  /** Request timeout in milliseconds */
  requestTimeout?: number
  /** Whether to serialize messages (default: true) */
  serializeMessages?: boolean
  /**
   * Whether debug-only emissions via {@link WorkerMessageChannel.emitDebug}
   * should fire. Mirrors {@link EventBus.debug} semantics: when `false`,
   * `emitDebug` is a no-op so callers can emit unconditionally without
   * producing noise in non-debug runs. Defaults to `false`.
   */
  debug?: boolean
}

const DEFAULT_REQUEST_TIMEOUT = 30000

/**
 * Context passed to method handlers identifying the requesting window.
 */
export interface RequestContext {
  windowId: string | undefined
}

/**
 * Generic worker interface that supports postMessage.
 */
export interface MessageTarget {
  postMessage(message: unknown): void
}

/**
 * Message channel for window-to-worker communication.
 *
 * Also acts as an {@link IEventSink} for this thread. `emit`/`emitDebug`
 * push library events straight into the local `events$` subject — they
 * never cross `postMessage` — so any main-thread producer (logger,
 * future local-only announcers, etc.) can surface events on
 * `libraryEvents$` alongside events forwarded from the worker. One
 * stream, one source of truth per thread, regardless of event origin.
 */
export class WorkerMessageChannel implements IEventSink<any> {
  private readonly target: MessageTarget
  private readonly config: Required<MessageChannelConfig>

  private readonly messages$ = new Subject<WorkerMessage>()
  private readonly events$ = new Subject<EventMessage>()
  private readonly workerInstance$ = new Subject<string>()

  private messageListener: ((event: MessageEvent) => void) | undefined

  constructor(target: MessageTarget, config: MessageChannelConfig = {}) {
    this.target = target
    this.config = {
      requestTimeout: config.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT,
      serializeMessages: config.serializeMessages ?? true,
      debug: config.debug ?? false,
    }
  }

  emit<T extends LibraryEventType>(type: T, data: LibraryEventData<any>[T]): void {
    this.events$.next({ type: 'event', eventName: type, data })
  }

  emitDebug<T extends LibraryEventType>(type: T, data: LibraryEventData<any>[T]): void {
    if (!this.config.debug) return
    this.events$.next({ type: 'event', eventName: type, data, debug: true })
  }

  /**
   * Start listening for messages.
   */
  connect(source: EventTarget): void {
    if (this.messageListener) {
      return
    }

    this.messageListener = (event: MessageEvent) => {
      let data: WorkerMessage
      try {
        data = this.config.serializeMessages
          ? deserialize<WorkerMessage>(event.data)
          : (event.data as WorkerMessage)
      } catch (err) {
        logProvider.log.error('Message deserialization failed', {
          err,
          raw: String(event.data).slice(0, 200),
        })
        return
      }

      if (isEventMessage(data)) {
        this.events$.next(data)
      } else if (isWorkerInstanceMessage(data)) {
        this.workerInstance$.next(data.workerInstanceId)
      }

      this.messages$.next(data)
    }

    source.addEventListener('message', this.messageListener as EventListener)
  }

  /**
   * Stop listening for messages.
   */
  disconnect(source: EventTarget): void {
    if (this.messageListener) {
      source.removeEventListener('message', this.messageListener as EventListener)
      this.messageListener = undefined
    }
  }

  /**
   * Send a request and wait for response.
   *
   * @param method - Method name to invoke
   * @param args - Method arguments
   * @returns Response result
   */
  async request<T>(method: string, args: unknown[] = []): Promise<T> {
    const requestId = generateId()

    const request: RequestMessage = {
      type: 'request',
      requestId,
      method,
      args,
    }

    // Set up response listener before sending
    const responsePromise = firstValueFrom(
      this.messages$.pipe(
        filter(
          (msg): msg is ResponseMessage => isResponseMessage(msg) && msg.requestId === requestId,
        ),
        take(1),
        timeout(this.config.requestTimeout),
      ),
    )

    // Send request
    this.send(request)

    // Wait for response
    const response = await responsePromise

    if (!response.success) {
      throw new RpcError(response.error ?? 'Request failed', response.errorCode)
    }

    return response.result as T
  }

  /**
   * Register a window with the worker.
   *
   * @param windowId - Window identifier
   * @returns Registration response
   */
  async register(windowId: string): Promise<RegisterWindowResponse> {
    const requestId = generateId()

    const request: RegisterWindowRequest = {
      type: 'register',
      requestId,
      windowId,
    }

    const responsePromise = firstValueFrom(
      this.messages$.pipe(
        filter(
          (msg): msg is RegisterWindowResponse =>
            msg.type === 'register-response' && msg.requestId === requestId,
        ),
        take(1),
        timeout(this.config.requestTimeout),
      ),
    )

    this.send(request)

    return responsePromise
  }

  /**
   * Send a heartbeat.
   *
   * @param windowId - Window identifier
   */
  sendHeartbeat(windowId: string): void {
    const message: HeartbeatMessage = {
      type: 'heartbeat',
      windowId,
    }
    this.send(message)
  }

  /**
   * Unregister a window.
   *
   * @param windowId - Window identifier
   */
  unregister(windowId: string): void {
    const message: UnregisterWindowMessage = {
      type: 'unregister',
      windowId,
    }
    this.send(message)
  }

  /**
   * Restore holds after worker restart.
   *
   * @param windowId - Window identifier
   * @param cacheKeys - Cache keys to restore
   * @returns Restoration response
   */
  async restoreHolds(windowId: string, cacheKeys: string[]): Promise<RestoreHoldsResponse> {
    const requestId = generateId()

    const request: RestoreHoldsRequest = {
      type: 'restore-holds',
      requestId,
      windowId,
      cacheKeys,
    }

    const responsePromise = firstValueFrom(
      this.messages$.pipe(
        filter(
          (msg): msg is RestoreHoldsResponse =>
            msg.type === 'restore-holds-response' && msg.requestId === requestId,
        ),
        take(1),
        timeout(this.config.requestTimeout),
      ),
    )

    this.send(request)

    return responsePromise
  }

  /**
   * Get observable of library events.
   */
  get libraryEvents$(): Observable<EventMessage> {
    return this.events$.asObservable()
  }

  /**
   * Get observable of worker instance changes.
   */
  get workerInstanceChanges$(): Observable<string> {
    return this.workerInstance$.asObservable()
  }

  /**
   * Send a message to the worker.
   */
  private send(message: WorkerMessage): void {
    const data = this.config.serializeMessages ? serialize(message) : message
    this.target.postMessage(data)
  }

  /**
   * Destroy the channel.
   */
  destroy(): void {
    this.messages$.complete()
    this.events$.complete()
    this.workerInstance$.complete()
  }
}

/**
 * Configuration for {@link WorkerMessageHandler}.
 */
export interface WorkerMessageHandlerConfig extends MessageChannelConfig {
  /**
   * Custom response target for sending messages back to the main thread.
   * Defaults to `globalThis.postMessage` (Web Worker context).
   * For Electron utility processes, pass the MessagePort connected to the renderer.
   */
  responseTarget?: MessageTarget
}

/**
 * Message handler for worker-side communication.
 */
export class WorkerMessageHandler {
  private readonly workerInstanceId: string
  private readonly config: Required<MessageChannelConfig>
  private readonly responseTarget: MessageTarget | undefined

  private readonly connectedPorts = new Set<MessagePort>()
  private readonly windowLastSeen = new Map<string, number>()
  private readonly windowPorts = new Map<string, MessagePort>()
  private readonly portToWindowId = new Map<MessagePort, string>()
  private readonly windowRemovedCallbacks: Array<(windowId: string) => Promise<void>> = []
  private isDedicatedWorker = false
  private restoreHoldsHandler:
    | ((data: RestoreHoldsRequest) => Promise<{ restoredKeys: string[]; failedKeys: string[] }>)
    | undefined

  private rawMessageHook:
    | ((event: MessageEvent, port: MessagePort | undefined) => boolean)
    | undefined

  private methodHandlers = new Map<
    string,
    (args: unknown[], context: RequestContext) => Promise<unknown>
  >()

  constructor(config: WorkerMessageHandlerConfig = {}) {
    this.workerInstanceId = generateId()
    this.responseTarget = config.responseTarget
    this.config = {
      requestTimeout: config.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT,
      serializeMessages: config.serializeMessages ?? true,
      debug: config.debug ?? false,
    }
  }

  /**
   * Get the worker instance ID.
   */
  get instanceId(): string {
    return this.workerInstanceId
  }

  /**
   * Set a hook that intercepts raw MessageEvents before standard handling.
   *
   * Used by startSharedWorker to intercept coordinator protocol messages
   * (which include `event.ports` Transferables) before standard deserialization.
   * The hook returns `true` if it handled the message (suppressing normal handling).
   */
  setRawMessageHook(hook: (event: MessageEvent, port: MessagePort | undefined) => boolean): void {
    this.rawMessageHook = hook
  }

  /**
   * Handle a new connection (SharedWorker).
   *
   * @param port - MessagePort from the connect event
   */
  handleConnect(port: MessagePort): void {
    this.connectedPorts.add(port)

    port.onmessage = (event) => {
      if (this.rawMessageHook?.(event, port)) return
      this.handleMessage(event.data, port)
    }

    // Send worker instance ID
    this.sendToPort(port, {
      type: 'worker-instance',
      workerInstanceId: this.workerInstanceId,
    } as WorkerInstanceMessage)

    port.start()
  }

  /**
   * Handle a message (Dedicated Worker).
   *
   * @param event - Message event
   */
  handleMessageEvent(event: MessageEvent): void {
    this.handleData(event.data)
  }

  /**
   * Handle a raw message payload (no port context).
   *
   * Use this in environments without DOM `MessageEvent` (e.g., Electron utility process).
   *
   * @param data - Raw message data
   */
  handleData(data: unknown): void {
    this.handleMessage(data, undefined)
  }

  /**
   * Send worker-instance message (Dedicated Worker startup).
   */
  sendWorkerInstance(): void {
    this.isDedicatedWorker = true
    this.sendResponse({
      type: 'worker-instance',
      workerInstanceId: this.workerInstanceId,
    } as WorkerInstanceMessage)
  }

  /**
   * Register a method handler.
   *
   * @param method - Method name
   * @param handler - Handler function
   */
  registerMethod(
    method: string,
    handler: (args: unknown[], context: RequestContext) => Promise<unknown>,
  ): void {
    this.methodHandlers.set(method, handler)
  }

  /**
   * Broadcast an event to all connected windows.
   *
   * @param eventName - Event name
   * @param data - Event data
   * @param debug - Whether this is a debug-only event
   */
  broadcastEvent(eventName: string, data: unknown, debug?: boolean): void {
    const message: EventMessage = {
      type: 'event',
      eventName,
      data,
      debug,
    }

    if (this.isDedicatedWorker) {
      this.sendResponse(message)
    } else {
      for (const port of this.connectedPorts) {
        this.sendToPort(port, message)
      }
    }
  }

  /**
   * Send response to requester (Dedicated Worker or custom response target).
   *
   * @param response - Response message
   */
  sendResponse(response: WorkerMessage): void {
    const data = this.config.serializeMessages ? serialize(response) : response
    if (this.responseTarget) {
      this.responseTarget.postMessage(data)
    } else {
      // In dedicated worker context, use global postMessage.
      // TypeScript compiles this file for browser context where `globalThis` lacks
      // `postMessage` — the double cast is unavoidable without a separate compilation target.
      ;(globalThis as unknown as { postMessage: (data: unknown) => void }).postMessage(data)
    }
  }

  /**
   * Get registered window IDs.
   */
  getRegisteredWindows(): string[] {
    return Array.from(this.windowLastSeen.keys())
  }

  /**
   * Check if a window is still alive (within TTL).
   *
   * @param windowId - Window identifier
   * @param ttlMs - Time-to-live in milliseconds
   * @returns Whether the window is alive
   */
  isWindowAlive(windowId: string, ttlMs: number): boolean {
    const lastSeen = this.windowLastSeen.get(windowId)
    if (lastSeen === undefined) {
      return false
    }
    return Date.now() - lastSeen <= ttlMs
  }

  /**
   * Get dead windows (exceeded TTL).
   *
   * @param ttlMs - Time-to-live in milliseconds
   * @returns Array of dead window IDs
   */
  getDeadWindows(ttlMs: number): string[] {
    const now = Date.now()
    const dead: string[] = []

    for (const [windowId, lastSeen] of this.windowLastSeen) {
      if (now - lastSeen > ttlMs) {
        dead.push(windowId)
      }
    }

    return dead
  }

  /**
   * Remove a window registration and notify listeners.
   *
   * @param windowId - Window identifier
   */
  async removeWindow(windowId: string): Promise<void> {
    this.windowLastSeen.delete(windowId)
    const port = this.windowPorts.get(windowId)
    if (port) {
      this.connectedPorts.delete(port)
      this.windowPorts.delete(windowId)
      this.portToWindowId.delete(port)
    }
    for (const callback of this.windowRemovedCallbacks) {
      await callback(windowId)
    }
  }

  /**
   * Register a callback for when a window is removed.
   *
   * @param callback - Async callback receiving the removed window ID
   */
  onWindowRemoved(callback: (windowId: string) => Promise<void>): void {
    this.windowRemovedCallbacks.push(callback)
  }

  /**
   * Register the handler for restore-holds requests.
   *
   * @param handler - Handler that restores holds and returns results
   */
  setRestoreHoldsHandler(
    handler: (
      data: RestoreHoldsRequest,
    ) => Promise<{ restoredKeys: string[]; failedKeys: string[] }>,
  ): void {
    this.restoreHoldsHandler = handler
  }

  private handleMessage(rawData: unknown, port: MessagePort | undefined): void {
    const data = this.config.serializeMessages
      ? deserialize<WorkerMessage>(rawData)
      : (rawData as WorkerMessage)

    if (typeof data !== 'object' || data === null) {
      logProvider.log.warn({ rawData }, 'Received unprocessable message — dropping')
      return
    }

    // Handle different message types
    if (data.type === 'register') {
      this.handleRegister(data, port)
    } else if (data.type === 'heartbeat') {
      this.handleHeartbeat(data)
    } else if (data.type === 'unregister') {
      this.handleUnregister(data)
    } else if (data.type === 'restore-holds') {
      this.handleRestoreHolds(data, port)
    } else if ('method' in data && 'args' in data) {
      this.handleRequest(data as RequestMessage, port)
    }
  }

  private handleRegister(data: RegisterWindowRequest, port: MessagePort | undefined): void {
    this.windowLastSeen.set(data.windowId, Date.now())
    if (port) {
      this.windowPorts.set(data.windowId, port)
      this.portToWindowId.set(port, data.windowId)
    }

    const response: RegisterWindowResponse = {
      type: 'register-response',
      requestId: data.requestId,
      success: true,
      workerInstanceId: this.workerInstanceId,
    }

    if (port) {
      this.sendToPort(port, response)
    } else {
      this.sendResponse(response)
    }
  }

  private handleHeartbeat(data: HeartbeatMessage): void {
    this.windowLastSeen.set(data.windowId, Date.now())
  }

  private async handleUnregister(data: UnregisterWindowMessage): Promise<void> {
    await this.removeWindow(data.windowId)
  }

  private async handleRestoreHolds(
    data: RestoreHoldsRequest,
    port: MessagePort | undefined,
  ): Promise<void> {
    let restoredKeys: string[] = []
    let failedKeys: string[] = data.cacheKeys

    if (this.restoreHoldsHandler) {
      try {
        const result = await this.restoreHoldsHandler(data)
        restoredKeys = result.restoredKeys
        failedKeys = result.failedKeys
      } catch (err) {
        logProvider.log.error({ err }, 'Failed to handle restore holds')
      }
    }

    const response: RestoreHoldsResponse = {
      type: 'restore-holds-response',
      requestId: data.requestId,
      success: true,
      restoredKeys,
      failedKeys,
    }

    if (port) {
      this.sendToPort(port, response)
    } else {
      this.sendResponse(response)
    }
  }

  private async handleRequest(data: RequestMessage, port: MessagePort | undefined): Promise<void> {
    try {
      const handler = this.methodHandlers.get(data.method)

      let response: ResponseMessage

      if (!handler) {
        response = {
          type: 'response',
          requestId: data.requestId,
          success: false,
          error: `Unknown method: ${data.method}`,
          errorCode: 'UNKNOWN_METHOD',
        }
      } else {
        try {
          const windowId = port ? this.portToWindowId.get(port) : undefined
          const context: RequestContext = { windowId }
          const result = await handler(data.args, context)
          response = {
            type: 'response',
            requestId: data.requestId,
            success: true,
            result,
          }
        } catch (err) {
          response = {
            type: 'response',
            requestId: data.requestId,
            success: false,
            error: err instanceof Error ? err.message : String(err),
            errorCode: getErrorCode(err),
          }
        }
      }

      logProvider.log.debug({
        label: 'rpc:handler-done',
        method: data.method,
        requestId: data.requestId,
        success: response.success,
      })

      if (port) {
        this.sendToPort(port, response)
      } else {
        this.sendResponse(response)
      }

      logProvider.log.debug({
        label: 'rpc:response-sent',
        method: data.method,
        requestId: data.requestId,
      })
    } catch (err) {
      logProvider.log.error(
        { err, method: data.method, requestId: data.requestId },
        'Failed to handle worker request',
      )
    }
  }

  private sendToPort(port: MessagePort, message: WorkerMessage): void {
    const data = this.config.serializeMessages ? serialize(message) : message
    port.postMessage(data)
  }
}

function getErrorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null) {
    // Exception subclasses use `errorCode: string`
    if ('errorCode' in err && typeof err.errorCode === 'string') return err.errorCode
  }
  // External errors may use `code: string` (e.g., DOMException)
  if (!(err instanceof Error) || !('code' in err)) return undefined
  const code: unknown = err.code
  return typeof code === 'string' ? code : undefined
}
