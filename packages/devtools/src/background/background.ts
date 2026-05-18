/**
 * Background service worker (MV3).
 *
 * Orchestrates connections between content scripts and panels.
 * Buffers events per tab so panels that open late still get history.
 */

import {
  MSG_ACTION,
  MSG_ACTIVATE,
  MSG_BUFFER_DUMP,
  MSG_CLIENT_DETECTED,
  MSG_COMMAND_SNAPSHOT,
  MSG_DEACTIVATE,
  MSG_EVENT,
  MSG_NET_CAPTURE_START,
  MSG_NET_CAPTURE_STATE,
  MSG_NET_CAPTURE_STOP,
  MSG_NET_EVENT,
  MSG_PANEL_CLEAR,
  MSG_PANEL_CONNECT,
  MSG_REQUEST_STORAGE,
  MSG_STORAGE_RESPONSE,
  PORT_CONTENT_SCRIPT,
  PORT_PANEL,
} from '../shared/constants.js'
import type {
  ActionMessage,
  BufferDumpMessage,
  ClientDetectedMessage,
  CommandSnapshotMessage,
  EventMessage,
  NetCaptureStartMessage,
  NetCaptureStateMessage,
  NetEventMessage,
  PanelConnectMessage,
} from '../shared/protocol.js'
import { EventBuffer } from './event-buffer.js'
import { NetworkCaptureManager } from './network-capture.js'
import { PortManager } from './port-manager.js'

const ports = new PortManager()
const buffers = new EventBuffer()
const networkCapture = new NetworkCaptureManager()

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === PORT_CONTENT_SCRIPT) {
    handleContentScriptConnect(port)
  } else if (port.name === PORT_PANEL) {
    handlePanelConnect(port)
  }
})

// Clean up on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  ports.removeTab(tabId)
  buffers.delete(tabId)
  networkCapture.dropTab(tabId)
})

function handleContentScriptConnect(port: chrome.runtime.Port): void {
  // Content scripts have sender.tab
  const tabId = port.sender?.tab?.id
  if (tabId === undefined) return

  ports.addContentPort(tabId, port)

  // If panel is already open, activate the hook
  if (ports.hasPanelPort(tabId)) {
    port.postMessage({ type: MSG_ACTIVATE })
  }

  port.onMessage.addListener((message: unknown) => {
    const msg = message as { type?: string } | undefined
    if (!msg?.type) return

    switch (msg.type) {
      case MSG_CLIENT_DETECTED: {
        const detected = msg as unknown as ClientDetectedMessage
        buffers.setConfig(tabId, detected.config, detected.role, detected.mode, detected.workerUrl)
        // Forward to panel if connected
        const panelPort = ports.getPanelPort(tabId)
        if (panelPort) {
          panelPort.postMessage(msg)
        }
        break
      }

      case MSG_EVENT: {
        const eventMsg = msg as unknown as EventMessage
        buffers.addEvent(tabId, eventMsg.event)
        // Forward to panel if connected
        const panelPort = ports.getPanelPort(tabId)
        if (panelPort) {
          panelPort.postMessage(msg)
        }
        break
      }

      case MSG_COMMAND_SNAPSHOT: {
        const snapshotMsg = msg as unknown as CommandSnapshotMessage
        buffers.setCommands(tabId, snapshotMsg.commands)
        // Forward to panel if connected
        const panelPort = ports.getPanelPort(tabId)
        if (panelPort) {
          panelPort.postMessage(msg)
        }
        break
      }

      case MSG_STORAGE_RESPONSE: {
        // Forward storage response to panel (no buffering)
        const panelPort = ports.getPanelPort(tabId)
        if (panelPort) {
          panelPort.postMessage(msg)
        }
        break
      }

      case MSG_NET_EVENT: {
        // Library-source network event from the page hook. Forward to the
        // panel using the same NetEventMessage shape the CDP path produces
        // — both terminate in the panel's network store.
        const panelPort = ports.getPanelPort(tabId)
        if (panelPort) {
          panelPort.postMessage(msg)
        }
        break
      }
    }
  })

  port.onDisconnect.addListener(() => {
    ports.removePort(port)
  })
}

function handlePanelConnect(port: chrome.runtime.Port): void {
  let panelTabId: number | undefined

  port.onMessage.addListener((message: unknown) => {
    const msg = message as { type?: string } | undefined
    if (!msg?.type) return

    switch (msg.type) {
      case MSG_PANEL_CONNECT: {
        const connectMsg = msg as unknown as PanelConnectMessage
        panelTabId = connectMsg.tabId
        ports.addPanelPort(panelTabId, port)

        // Send buffered state to panel
        const buffer = buffers.get(panelTabId)
        const dumpMsg: BufferDumpMessage = {
          type: MSG_BUFFER_DUMP,
          config: buffer?.config,
          role: buffer?.role,
          mode: buffer?.mode,
          workerUrl: buffer?.workerUrl,
          events: buffer?.events ?? [],
          commands: buffer?.commands ?? [],
        }
        port.postMessage(dumpMsg)

        // Activate hook via content script
        const contentPort = ports.getContentPort(panelTabId)
        if (contentPort) {
          contentPort.postMessage({ type: MSG_ACTIVATE })
        }
        break
      }

      case MSG_PANEL_CLEAR: {
        if (panelTabId !== undefined) {
          buffers.clear(panelTabId)
        }
        break
      }

      case MSG_ACTION: {
        if (panelTabId !== undefined) {
          const actionMsg = msg as unknown as ActionMessage
          const contentPort = ports.getContentPort(panelTabId)
          if (contentPort) {
            contentPort.postMessage({
              type: MSG_ACTION,
              action: actionMsg.action,
              commandId: actionMsg.commandId,
            })
          }
        }
        break
      }

      case MSG_REQUEST_STORAGE: {
        if (panelTabId !== undefined) {
          const contentPort = ports.getContentPort(panelTabId)
          if (contentPort) {
            contentPort.postMessage(msg)
          }
        }
        break
      }

      case MSG_NET_CAPTURE_START: {
        if (panelTabId === undefined) break
        const tabIdForCapture = panelTabId
        const startMsg = msg as unknown as NetCaptureStartMessage
        void networkCapture.start(
          tabIdForCapture,
          startMsg.origin,
          startMsg.mode,
          (event) => {
            const panelPort = ports.getPanelPort(tabIdForCapture)
            if (panelPort) {
              const netMsg: NetEventMessage = { type: MSG_NET_EVENT, event }
              panelPort.postMessage(netMsg)
            }
          },
          (state) => {
            const panelPort = ports.getPanelPort(tabIdForCapture)
            if (panelPort) {
              const stateMsg: NetCaptureStateMessage = { type: MSG_NET_CAPTURE_STATE, state }
              panelPort.postMessage(stateMsg)
            }
          },
        )
        break
      }

      case MSG_NET_CAPTURE_STOP: {
        if (panelTabId !== undefined) {
          void networkCapture.stop(panelTabId)
        }
        break
      }
    }
  })

  port.onDisconnect.addListener(() => {
    if (panelTabId !== undefined) {
      ports.removePort(port)

      // Deactivate hook via content script
      const contentPort = ports.getContentPort(panelTabId)
      if (contentPort) {
        contentPort.postMessage({ type: MSG_DEACTIVATE })
      }

      // Closing the panel ends the debugger session — the user can't drive
      // Start/Stop without a panel, and leaving the banner up after they
      // closed devtools would be confusing.
      void networkCapture.stop(panelTabId)
    }
  })
}
