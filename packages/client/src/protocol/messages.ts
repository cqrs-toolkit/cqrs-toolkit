/**
 * Protocol messages for worker communication.
 *
 * This module defines the message types used for communication between
 * window contexts and storage workers (SharedWorker, Dedicated Worker).
 */

/**
 * Base message structure.
 */
export interface BaseMessage {
  /** Message type identifier */
  type: string
  /** Unique request ID for correlation */
  requestId: string
}

/**
 * Request message from window to worker.
 */
export interface RequestMessage extends BaseMessage {
  type: 'request'
  /** Method to invoke */
  method: string
  /** Method arguments */
  args: unknown[]
}

/**
 * Response message from worker to window.
 */
export interface ResponseMessage extends BaseMessage {
  type: 'response'
  /** Whether the request succeeded */
  success: boolean
  /** Result data (on success) */
  result?: unknown
  /** Error message (on failure) */
  error?: string
  /** Error code (on failure) */
  errorCode?: string
}

/**
 * Event message broadcast from worker to windows.
 */
export interface EventMessage {
  type: 'event'
  /** Event name */
  eventName: string
  /** Event data */
  data: unknown
  /** Whether this is a debug-only event */
  debug?: boolean
}

/**
 * Window registration request.
 */
export interface RegisterWindowRequest extends BaseMessage {
  type: 'register'
  /** Unique window identifier */
  windowId: string
}

/**
 * Window registration response.
 */
export interface RegisterWindowResponse extends BaseMessage {
  type: 'register-response'
  success: boolean
  /** Worker instance ID (for detecting restarts) */
  workerInstanceId: string
  /** Error message if registration failed */
  error?: string
}

/**
 * Window heartbeat message.
 */
export interface HeartbeatMessage {
  type: 'heartbeat'
  /** Window identifier */
  windowId: string
}

/**
 * Window unregister message.
 */
export interface UnregisterWindowMessage {
  type: 'unregister'
  /** Window identifier */
  windowId: string
}

/**
 * Hold restoration request (after worker restart).
 */
export interface RestoreHoldsRequest extends BaseMessage {
  type: 'restore-holds'
  /** Window identifier */
  windowId: string
  /** Cache keys to restore holds for */
  cacheKeys: string[]
}

/**
 * Hold restoration response.
 */
export interface RestoreHoldsResponse extends BaseMessage {
  type: 'restore-holds-response'
  success: boolean
  /** Keys that were successfully restored */
  restoredKeys: string[]
  /** Keys that failed to restore (no longer exist) */
  failedKeys: string[]
}

/**
 * Worker instance announcement (broadcast on connect/reconnect).
 */
export interface WorkerInstanceMessage {
  type: 'worker-instance'
  /** Unique worker instance ID */
  workerInstanceId: string
}

/**
 * All message types union.
 */
export type WorkerMessage =
  | RequestMessage
  | ResponseMessage
  | EventMessage
  | RegisterWindowRequest
  | RegisterWindowResponse
  | HeartbeatMessage
  | UnregisterWindowMessage
  | RestoreHoldsRequest
  | RestoreHoldsResponse
  | WorkerInstanceMessage

/**
 * Message type guards.
 */
export function isRequestMessage(msg: unknown): msg is RequestMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'method' in (msg as Record<string, unknown>) &&
    'requestId' in (msg as Record<string, unknown>) &&
    'args' in (msg as Record<string, unknown>)
  )
}

export function isResponseMessage(msg: unknown): msg is ResponseMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'requestId' in (msg as Record<string, unknown>) &&
    'success' in (msg as Record<string, unknown>)
  )
}

export function isEventMessage(msg: unknown): msg is EventMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as Record<string, unknown>).type === 'event' &&
    'eventName' in (msg as Record<string, unknown>)
  )
}

export function isRegisterRequest(msg: unknown): msg is RegisterWindowRequest {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as Record<string, unknown>).type === 'register' &&
    'windowId' in (msg as Record<string, unknown>)
  )
}

export function isHeartbeatMessage(msg: unknown): msg is HeartbeatMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as Record<string, unknown>).type === 'heartbeat' &&
    'windowId' in (msg as Record<string, unknown>)
  )
}

export function isUnregisterMessage(msg: unknown): msg is UnregisterWindowMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as Record<string, unknown>).type === 'unregister' &&
    'windowId' in (msg as Record<string, unknown>)
  )
}

export function isRestoreHoldsRequest(msg: unknown): msg is RestoreHoldsRequest {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as Record<string, unknown>).type === 'restore-holds' &&
    'cacheKeys' in (msg as Record<string, unknown>)
  )
}

export function isWorkerInstanceMessage(msg: unknown): msg is WorkerInstanceMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as Record<string, unknown>).type === 'worker-instance' &&
    'workerInstanceId' in (msg as Record<string, unknown>)
  )
}
