/**
 * Port manager for the background service worker.
 *
 * Tracks content-script ports (by tabId) and panel ports (by tabId)
 * with reverse lookup from port to tabId.
 */

export class PortManager {
  private readonly contentPorts = new Map<number, chrome.runtime.Port>()
  private readonly panelPorts = new Map<number, chrome.runtime.Port>()
  private readonly portToTab = new Map<chrome.runtime.Port, number>()

  addContentPort(tabId: number, port: chrome.runtime.Port): void {
    this.contentPorts.set(tabId, port)
    this.portToTab.set(port, tabId)
  }

  addPanelPort(tabId: number, port: chrome.runtime.Port): void {
    this.panelPorts.set(tabId, port)
    this.portToTab.set(port, tabId)
  }

  removePort(port: chrome.runtime.Port): number | undefined {
    const tabId = this.portToTab.get(port)
    if (tabId === undefined) return undefined

    this.portToTab.delete(port)

    if (this.contentPorts.get(tabId) === port) {
      this.contentPorts.delete(tabId)
    }
    if (this.panelPorts.get(tabId) === port) {
      this.panelPorts.delete(tabId)
    }

    return tabId
  }

  getContentPort(tabId: number): chrome.runtime.Port | undefined {
    return this.contentPorts.get(tabId)
  }

  getPanelPort(tabId: number): chrome.runtime.Port | undefined {
    return this.panelPorts.get(tabId)
  }

  getTabId(port: chrome.runtime.Port): number | undefined {
    return this.portToTab.get(port)
  }

  hasPanelPort(tabId: number): boolean {
    return this.panelPorts.has(tabId)
  }

  removeTab(tabId: number): void {
    const contentPort = this.contentPorts.get(tabId)
    if (contentPort) {
      this.portToTab.delete(contentPort)
      this.contentPorts.delete(tabId)
    }

    const panelPort = this.panelPorts.get(tabId)
    if (panelPort) {
      this.portToTab.delete(panelPort)
      this.panelPorts.delete(tabId)
    }
  }
}
