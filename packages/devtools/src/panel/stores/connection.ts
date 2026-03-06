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
  MSG_PANEL_CLEAR,
  MSG_PANEL_CONNECT,
  MSG_REQUEST_COMMAND_SNAPSHOT,
  PORT_PANEL,
} from '../../shared/constants.js'
import type {
  BufferDumpMessage,
  ClientDetectedMessage,
  CommandSnapshotMessage,
  EventMessage,
  SanitizedEvent,
  SerializedCommandRecord,
  SerializedConfig,
} from '../../shared/protocol.js'

export type ConnectionState = 'disconnected' | 'waiting' | 'connected'

export interface ConnectionEventHandlers {
  onEvent?: (event: SanitizedEvent) => void
  onCommandSnapshot?: (commands: SerializedCommandRecord[]) => void
  onBufferDump?: (dump: BufferDumpMessage) => void
  onClientDetected?: (config: SerializedConfig, role: 'leader' | 'standby') => void
}

export interface ConnectionStore {
  state: () => ConnectionState
  config: () => SerializedConfig | undefined
  role: () => 'leader' | 'standby' | undefined
  requestCommandSnapshot: () => void
  sendAction: (action: 'retry' | 'cancel', commandId: string) => void
  clearBuffer: () => void
}

export function createConnectionStore(handlers: ConnectionEventHandlers): ConnectionStore {
  const [state, setState] = createSignal<ConnectionState>('disconnected')
  const [config, setConfig] = createSignal<SerializedConfig | undefined>()
  const [role, setRole] = createSignal<'leader' | 'standby' | undefined>()

  let port: chrome.runtime.Port | undefined

  function connect(): void {
    port = chrome.runtime.connect({ name: PORT_PANEL })
    setState('waiting')

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
            setState('connected')
          }
          handlers.onBufferDump?.(dump)
          break
        }

        case MSG_CLIENT_DETECTED: {
          const detected = msg as unknown as ClientDetectedMessage
          setConfig(detected.config)
          setRole(detected.role)
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
      }
    })

    port.onDisconnect.addListener(() => {
      port = undefined
      setState('disconnected')
    })
  }

  // Connect immediately
  connect()

  return {
    state,
    config,
    role,
    requestCommandSnapshot() {
      port?.postMessage({ type: MSG_REQUEST_COMMAND_SNAPSHOT })
    },
    sendAction(action, commandId) {
      port?.postMessage({ type: MSG_ACTION, action, commandId })
    },
    clearBuffer() {
      port?.postMessage({ type: MSG_PANEL_CLEAR })
    },
  }
}
