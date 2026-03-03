/**
 * Message channel for worker communication.
 *
 * Provides request/response correlation and event broadcasting
 * over Worker postMessage API.
 */

import { Observable, Subject, filter, firstValueFrom, take, timeout } from 'rxjs'
import { generateId } from '../utils/uuid.js'
import type {
  EventMessage,
  HeartbeatMessage,
  RegisterWindowRequest,
  RegisterWindowResponse,
  RequestMessage,
  ResponseMessage,
  RestoreHoldsRequest,
  RestoreHoldsResponse,
  TabLockRelease,
  TabLockRequest,
  TabLockResponse,
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
}

const DEFAULT_REQUEST_TIMEOUT = 30000

/**
 * Generic worker interface that supports postMessage.
 */
export interface MessageTarget {
  postMessage(message: unknown): void
}

/**
 * Message channel for window-to-worker communication.
 */
export class WorkerMessageChannel {
  private readonly target: MessageTarget
  private readonly config: Required<MessageChannelConfig>

  private readonly messages$ = new Subject<WorkerMessage>()
  private readonly events$ = new Subject<EventMessage>()
  private readonly workerInstance$ = new Subject<string>()

  private messageListener: ((event: MessageEvent) => void) | null = null

  constructor(target: MessageTarget, config: MessageChannelConfig = {}) {
    this.target = target
    this.config = {
      requestTimeout: config.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT,
      serializeMessages: config.serializeMessages ?? true,
    }
  }

  /**
   * Start listening for messages.
   */
  connect(source: EventTarget): void {
    if (this.messageListener) {
      return
    }

    this.messageListener = (event: MessageEvent) => {
      const data = this.config.serializeMessages
        ? deserialize<WorkerMessage>(event.data)
        : (event.data as WorkerMessage)

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
      this.messageListener = null
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
      const error = new Error(response.error ?? 'Request failed')
      ;(error as Error & { code?: string }).code = response.errorCode
      throw error
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
   * Request tab lock (single-tab modes).
   *
   * @param tabId - Tab identifier
   * @returns Lock response
   */
  async requestTabLock(tabId: string): Promise<TabLockResponse> {
    const requestId = generateId()

    const request: TabLockRequest = {
      type: 'tab-lock',
      requestId,
      tabId,
    }

    const responsePromise = firstValueFrom(
      this.messages$.pipe(
        filter(
          (msg): msg is TabLockResponse =>
            msg.type === 'tab-lock-response' && msg.requestId === requestId,
        ),
        take(1),
        timeout(this.config.requestTimeout),
      ),
    )

    this.send(request)

    return responsePromise
  }

  /**
   * Release tab lock.
   *
   * @param tabId - Tab identifier
   */
  releaseTabLock(tabId: string): void {
    const message: TabLockRelease = {
      type: 'tab-lock-release',
      tabId,
    }
    this.send(message)
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
 * Message handler for worker-side communication.
 */
export class WorkerMessageHandler {
  private readonly workerInstanceId: string
  private readonly config: Required<MessageChannelConfig>

  private readonly connectedPorts = new Set<MessagePort>()
  private readonly windowLastSeen = new Map<string, number>()
  private readonly windowPorts = new Map<string, MessagePort>()

  private methodHandlers = new Map<string, (args: unknown[]) => Promise<unknown>>()

  constructor(config: MessageChannelConfig = {}) {
    this.workerInstanceId = generateId()
    this.config = {
      requestTimeout: config.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT,
      serializeMessages: config.serializeMessages ?? true,
    }
  }

  /**
   * Get the worker instance ID.
   */
  get instanceId(): string {
    return this.workerInstanceId
  }

  /**
   * Handle a new connection (SharedWorker).
   *
   * @param port - MessagePort from the connect event
   */
  handleConnect(port: MessagePort): void {
    this.connectedPorts.add(port)

    port.onmessage = (event) => {
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
    this.handleMessage(event.data, null)
  }

  /**
   * Register a method handler.
   *
   * @param method - Method name
   * @param handler - Handler function
   */
  registerMethod(method: string, handler: (args: unknown[]) => Promise<unknown>): void {
    this.methodHandlers.set(method, handler)
  }

  /**
   * Broadcast an event to all connected windows.
   *
   * @param eventName - Event name
   * @param payload - Event payload
   */
  broadcastEvent(eventName: string, payload: unknown): void {
    const message: EventMessage = {
      type: 'event',
      eventName,
      payload,
    }

    for (const port of this.connectedPorts) {
      this.sendToPort(port, message)
    }
  }

  /**
   * Send response to requester (Dedicated Worker).
   *
   * @param response - Response message
   */
  sendResponse(response: WorkerMessage): void {
    const data = this.config.serializeMessages ? serialize(response) : response
    // In dedicated worker context, use global postMessage
    ;(globalThis as unknown as { postMessage: (data: unknown) => void }).postMessage(data)
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
   * Remove a window registration.
   *
   * @param windowId - Window identifier
   */
  removeWindow(windowId: string): void {
    this.windowLastSeen.delete(windowId)
    const port = this.windowPorts.get(windowId)
    if (port) {
      this.connectedPorts.delete(port)
      this.windowPorts.delete(windowId)
    }
  }

  private handleMessage(rawData: unknown, port: MessagePort | null): void {
    const data = this.config.serializeMessages
      ? deserialize<WorkerMessage>(rawData)
      : (rawData as WorkerMessage)

    // Handle different message types
    if (data.type === 'register') {
      this.handleRegister(data, port)
    } else if (data.type === 'heartbeat') {
      this.handleHeartbeat(data)
    } else if (data.type === 'unregister') {
      this.handleUnregister(data)
    } else if (data.type === 'restore-holds') {
      this.handleRestoreHolds(data, port)
    } else if (data.type === 'tab-lock') {
      this.handleTabLock(data, port)
    } else if (data.type === 'tab-lock-release') {
      this.handleTabLockRelease(data)
    } else if ('method' in data && 'args' in data) {
      this.handleRequest(data as RequestMessage, port)
    }
  }

  private handleRegister(data: RegisterWindowRequest, port: MessagePort | null): void {
    this.windowLastSeen.set(data.windowId, Date.now())
    if (port) {
      this.windowPorts.set(data.windowId, port)
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

  private handleUnregister(data: UnregisterWindowMessage): void {
    this.removeWindow(data.windowId)
  }

  private handleRestoreHolds(_data: RestoreHoldsRequest, _port: MessagePort | null): void {
    // Subclasses should override this to handle hold restoration
    // Default implementation just acknowledges
  }

  private tabLockHolder: string | null = null

  private handleTabLock(data: TabLockRequest, port: MessagePort | null): void {
    const acquired = this.tabLockHolder === null || this.tabLockHolder === data.tabId

    if (acquired) {
      this.tabLockHolder = data.tabId
    }

    const response: TabLockResponse = {
      type: 'tab-lock-response',
      requestId: data.requestId,
      acquired,
      currentHolder: acquired ? undefined : (this.tabLockHolder ?? undefined),
    }

    if (port) {
      this.sendToPort(port, response)
    } else {
      this.sendResponse(response)
    }
  }

  private handleTabLockRelease(data: TabLockRelease): void {
    if (this.tabLockHolder === data.tabId) {
      this.tabLockHolder = null
    }
  }

  private async handleRequest(data: RequestMessage, port: MessagePort | null): Promise<void> {
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
        const result = await handler(data.args)
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
          errorCode: (err as Error & { code?: string }).code,
        }
      }
    }

    if (port) {
      this.sendToPort(port, response)
    } else {
      this.sendResponse(response)
    }
  }

  private sendToPort(port: MessagePort, message: WorkerMessage): void {
    const data = this.config.serializeMessages ? serialize(message) : message
    port.postMessage(data)
  }
}
