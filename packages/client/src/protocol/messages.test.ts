/**
 * Unit tests for message type guards.
 */

import { describe, expect, it } from 'vitest'
import {
  isEventMessage,
  isHeartbeatMessage,
  isRegisterRequest,
  isRequestMessage,
  isResponseMessage,
  isRestoreHoldsRequest,
  isUnregisterMessage,
  isWorkerInstanceMessage,
} from './messages.js'

describe('message type guards', () => {
  describe('isRequestMessage', () => {
    it('returns true for valid request message', () => {
      const msg = {
        method: 'storage.getSession',
        requestId: '123',
        args: [],
      }
      expect(isRequestMessage(msg)).toBe(true)
    })

    it('returns false for missing fields', () => {
      expect(isRequestMessage({ method: 'test' })).toBe(false)
      expect(isRequestMessage({ requestId: '123' })).toBe(false)
      expect(isRequestMessage(null)).toBe(false)
      expect(isRequestMessage(undefined)).toBe(false)
    })
  })

  describe('isResponseMessage', () => {
    it('returns true for valid response message', () => {
      const msg = {
        requestId: '123',
        success: true,
        result: 'data',
      }
      expect(isResponseMessage(msg)).toBe(true)
    })

    it('returns true for error response', () => {
      const msg = {
        requestId: '123',
        success: false,
        error: 'Something went wrong',
      }
      expect(isResponseMessage(msg)).toBe(true)
    })

    it('returns false for missing fields', () => {
      expect(isResponseMessage({ success: true })).toBe(false)
      expect(isResponseMessage({ requestId: '123' })).toBe(false)
    })
  })

  describe('isEventMessage', () => {
    it('returns true for valid event message', () => {
      const msg = {
        type: 'event',
        eventName: 'session:updated',
        payload: { userId: '123' },
      }
      expect(isEventMessage(msg)).toBe(true)
    })

    it('returns false for other message types', () => {
      expect(isEventMessage({ type: 'request', eventName: 'test' })).toBe(false)
      expect(isEventMessage({ type: 'event' })).toBe(false)
    })
  })

  describe('isRegisterRequest', () => {
    it('returns true for valid register request', () => {
      const msg = {
        type: 'register',
        requestId: '123',
        windowId: 'win-456',
      }
      expect(isRegisterRequest(msg)).toBe(true)
    })

    it('returns false for invalid messages', () => {
      expect(isRegisterRequest({ type: 'unregister', windowId: '123' })).toBe(false)
      expect(isRegisterRequest({ type: 'register' })).toBe(false)
    })
  })

  describe('isHeartbeatMessage', () => {
    it('returns true for valid heartbeat', () => {
      const msg = {
        type: 'heartbeat',
        windowId: 'win-123',
      }
      expect(isHeartbeatMessage(msg)).toBe(true)
    })

    it('returns false for invalid messages', () => {
      expect(isHeartbeatMessage({ type: 'heartbeat' })).toBe(false)
      expect(isHeartbeatMessage({ windowId: '123' })).toBe(false)
    })
  })

  describe('isUnregisterMessage', () => {
    it('returns true for valid unregister', () => {
      const msg = {
        type: 'unregister',
        windowId: 'win-123',
      }
      expect(isUnregisterMessage(msg)).toBe(true)
    })
  })

  describe('isRestoreHoldsRequest', () => {
    it('returns true for valid restore holds request', () => {
      const msg = {
        type: 'restore-holds',
        requestId: '123',
        windowId: 'win-456',
        cacheKeys: ['key1', 'key2'],
      }
      expect(isRestoreHoldsRequest(msg)).toBe(true)
    })

    it('returns false for missing cacheKeys', () => {
      expect(isRestoreHoldsRequest({ type: 'restore-holds', windowId: '123' })).toBe(false)
    })
  })

  describe('isWorkerInstanceMessage', () => {
    it('returns true for valid worker instance message', () => {
      const msg = {
        type: 'worker-instance',
        workerInstanceId: 'inst-123',
      }
      expect(isWorkerInstanceMessage(msg)).toBe(true)
    })
  })
})
