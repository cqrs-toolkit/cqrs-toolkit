import { describe, expect, it } from 'vitest'
import { PortManager } from './port-manager.js'

function fakePort(name = 'test'): chrome.runtime.Port {
  return { name } as unknown as chrome.runtime.Port
}

describe('PortManager', () => {
  it('tracks content ports by tabId', () => {
    const pm = new PortManager()
    const port = fakePort('content-script')

    pm.addContentPort(42, port)

    expect(pm.getContentPort(42)).toBe(port)
    expect(pm.getTabId(port)).toBe(42)
  })

  it('tracks panel ports by tabId', () => {
    const pm = new PortManager()
    const port = fakePort('panel')

    pm.addPanelPort(7, port)

    expect(pm.getPanelPort(7)).toBe(port)
    expect(pm.hasPanelPort(7)).toBe(true)
    expect(pm.getTabId(port)).toBe(7)
  })

  it('removes a content port and returns the tabId', () => {
    const pm = new PortManager()
    const port = fakePort()

    pm.addContentPort(10, port)
    const tabId = pm.removePort(port)

    expect(tabId).toBe(10)
    expect(pm.getContentPort(10)).toBeUndefined()
    expect(pm.getTabId(port)).toBeUndefined()
  })

  it('removes a panel port and returns the tabId', () => {
    const pm = new PortManager()
    const port = fakePort()

    pm.addPanelPort(10, port)
    const tabId = pm.removePort(port)

    expect(tabId).toBe(10)
    expect(pm.getPanelPort(10)).toBeUndefined()
    expect(pm.hasPanelPort(10)).toBe(false)
  })

  it('returns undefined when removing an unknown port', () => {
    const pm = new PortManager()
    const port = fakePort()

    expect(pm.removePort(port)).toBeUndefined()
  })

  it('removes all ports for a tab', () => {
    const pm = new PortManager()
    const content = fakePort('content')
    const panel = fakePort('panel')

    pm.addContentPort(5, content)
    pm.addPanelPort(5, panel)

    pm.removeTab(5)

    expect(pm.getContentPort(5)).toBeUndefined()
    expect(pm.getPanelPort(5)).toBeUndefined()
    expect(pm.getTabId(content)).toBeUndefined()
    expect(pm.getTabId(panel)).toBeUndefined()
  })

  it('replaces existing port when adding same tabId', () => {
    const pm = new PortManager()
    const old = fakePort('old')
    const fresh = fakePort('fresh')

    pm.addContentPort(1, old)
    pm.addContentPort(1, fresh)

    expect(pm.getContentPort(1)).toBe(fresh)
    expect(pm.getTabId(fresh)).toBe(1)
  })
})
