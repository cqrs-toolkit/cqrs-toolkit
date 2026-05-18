/**
 * Connection store — central nervous system of the panel.
 *
 * Manages the chrome.runtime port to the background service worker,
 * dispatches incoming events to registered listeners, and tracks
 * connection + client state.
 */

import { createSignal } from 'solid-js'
import {
  MSG_ACTION,
  MSG_BUFFER_DUMP,
  MSG_CLIENT_DETECTED,
  MSG_COMMAND_SNAPSHOT,
  MSG_EVENT,
  MSG_NET_CAPTURE_START,
  MSG_NET_CAPTURE_STATE,
  MSG_NET_CAPTURE_STOP,
  MSG_NET_EVENT,
  MSG_PANEL_CLEAR,
  MSG_PANEL_CONNECT,
  MSG_REQUEST_STORAGE,
  MSG_STORAGE_RESPONSE,
  PORT_PANEL,
} from '../../shared/constants.js'
import type {
  BufferDumpMessage,
  ClientDetectedMessage,
  ClientMode,
  CommandSnapshotMessage,
  EventMessage,
  NetCaptureState,
  NetCaptureStateMessage,
  NetEventMessage,
  NetworkProbeEvent,
  SanitizedEvent,
  SerializedCommandRecord,
  SerializedConfig,
  StorageResponseMessage,
} from '../../shared/protocol.js'

export type ConnectionState = 'disconnected' | 'waiting' | 'connected'

export interface ConnectionEventHandlers {
  onEvent?: (event: SanitizedEvent) => void
  onCommandSnapshot?: (commands: SerializedCommandRecord[]) => void
  onBufferDump?: (dump: BufferDumpMessage) => void
  onClientDetected?: (config: SerializedConfig, role: 'leader' | 'standby') => void
  onNetEvent?: (event: NetworkProbeEvent) => void
  onNetState?: (state: NetCaptureState) => void
}

export interface ConnectionStore {
  state: () => ConnectionState
  config: () => SerializedConfig | undefined
  role: () => 'leader' | 'standby' | undefined
  mode: () => ClientMode | undefined
  workerUrl: () => string | undefined
  sendAction: (action: 'retry' | 'cancel', commandId: string) => void
  clearBuffer: () => void
  execSql: (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>
  startNetCapture: (origin: string, mode: ClientMode | undefined) => void
  stopNetCapture: () => void
}

export function createConnectionStore(handlers: ConnectionEventHandlers): ConnectionStore {
  const [state, setState] = createSignal<ConnectionState>('disconnected')
  const [config, setConfig] = createSignal<SerializedConfig | undefined>()
  const [role, setRole] = createSignal<'leader' | 'standby' | undefined>()
  const [mode, setMode] = createSignal<ClientMode | undefined>()
  const [workerUrl, setWorkerUrl] = createSignal<string | undefined>()

  let port: chrome.runtime.Port | undefined

  const pendingStorage = new Map<
    string,
    { resolve: (rows: Record<string, unknown>[]) => void; reject: (err: Error) => void }
  >()

  function connect(): void {
    port = chrome.runtime.connect({ name: PORT_PANEL })

    // Send panel-connect with the inspected tab's ID
    port.postMessage({
      type: MSG_PANEL_CONNECT,
      tabId: chrome.devtools.inspectedWindow.tabId,
    })

    port.onMessage.addListener((message: unknown) => {
      const msg = message as { type?: string } | undefined
      if (!msg?.type) return

      switch (msg.type) {
        case MSG_BUFFER_DUMP: {
          const dump = msg as unknown as BufferDumpMessage
          if (dump.config) {
            setConfig(dump.config)
            setRole(dump.role)
            setMode(dump.mode)
            setWorkerUrl(dump.workerUrl)
            setState('connected')
          } else if (config()) {
            // Reconnect after service worker restart: buffer is empty but we
            // already know the client from a previous connection. Restore
            // 'connected' state — the content script will re-detect the client
            // on the next page load.
            setState('connected')
          } else {
            setState('waiting')
          }
          handlers.onBufferDump?.(dump)
          break
        }

        case MSG_CLIENT_DETECTED: {
          const detected = msg as unknown as ClientDetectedMessage
          setConfig(detected.config)
          setRole(detected.role)
          setMode(detected.mode)
          setWorkerUrl(detected.workerUrl)
          setState('connected')
          handlers.onClientDetected?.(detected.config, detected.role)
          break
        }

        case MSG_EVENT: {
          const eventMsg = msg as unknown as EventMessage
          handlers.onEvent?.(eventMsg.event)
          break
        }

        case MSG_COMMAND_SNAPSHOT: {
          const snapshot = msg as unknown as CommandSnapshotMessage
          handlers.onCommandSnapshot?.(snapshot.commands)
          break
        }

        case MSG_STORAGE_RESPONSE: {
          const response = msg as unknown as StorageResponseMessage
          const pending = pendingStorage.get(response.requestId)
          if (pending) {
            pendingStorage.delete(response.requestId)
            if (response.error) {
              pending.reject(new Error(response.error))
            } else {
              pending.resolve(response.rows)
            }
          }
          break
        }

        case MSG_NET_EVENT: {
          const netMsg = msg as unknown as NetEventMessage
          handlers.onNetEvent?.(netMsg.event)
          break
        }

        case MSG_NET_CAPTURE_STATE: {
          const stateMsg = msg as unknown as NetCaptureStateMessage
          handlers.onNetState?.(stateMsg.state)
          break
        }
      }
    })

    port.onDisconnect.addListener(() => {
      port = undefined
      // MV3 service workers go idle and terminate, dropping the port.
      // Reconnect immediately — chrome.runtime.connect() wakes the worker.
      reconnect()
    })
  }

  function reconnect(): void {
    // Untracked setTimeout is intentional here:
    // - No cleanup needed: the panel runs in a dedicated DevTools page whose
    //   destruction (on DevTools close) tears down all pending timers.
    // - No double-fire risk: onDisconnect fires exactly once per port, and the
    //   flow is serial (disconnect → delay → connect creates a new port).
    setTimeout(connect, 500)
  }

  // Connect immediately
  connect()

  return {
    state,
    config,
    role,
    mode,
    workerUrl,
    sendAction(action, commandId) {
      port?.postMessage({ type: MSG_ACTION, action, commandId })
    },
    clearBuffer() {
      port?.postMessage({ type: MSG_PANEL_CLEAR })
    },
    execSql(sql, bind) {
      return new Promise((resolve, reject) => {
        if (!port) {
          reject(new Error('Not connected'))
          return
        }
        const requestId = crypto.randomUUID()
        pendingStorage.set(requestId, { resolve, reject })
        port.postMessage({ type: MSG_REQUEST_STORAGE, sql, bind, requestId })
      })
    },
    startNetCapture(origin: string, captureMode: ClientMode | undefined) {
      port?.postMessage({ type: MSG_NET_CAPTURE_START, origin, mode: captureMode })
    },
    stopNetCapture() {
      port?.postMessage({ type: MSG_NET_CAPTURE_STOP })
    },
  }
}
