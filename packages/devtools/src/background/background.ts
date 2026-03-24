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
  MSG_PANEL_CLEAR,
  MSG_PANEL_CONNECT,
  MSG_REQUEST_STORAGE,
  MSG_STORAGE_RESPONSE,
  PORT_CONTENT_SCRIPT,
  PORT_PANEL,
} from '../shared/constants.js'
import type {
  ActionMessage,
  ClientDetectedMessage,
  CommandSnapshotMessage,
  EventMessage,
  PanelConnectMessage,
  SanitizedEvent,
  SerializedCommandRecord,
  SerializedConfig,
} from '../shared/protocol.js'
import { EventBuffer } from './event-buffer.js'
import { PortManager } from './port-manager.js'

const ports = new PortManager()
const buffers = new EventBuffer()

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
        buffers.setConfig(tabId, detected.config, detected.role)
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
        const dumpMsg: {
          type: string
          config: SerializedConfig | undefined
          role: 'leader' | 'standby' | undefined
          events: SanitizedEvent[]
          commands: SerializedCommandRecord[]
        } = {
          type: MSG_BUFFER_DUMP,
          config: buffer?.config,
          role: buffer?.role,
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
    }
  })
}
