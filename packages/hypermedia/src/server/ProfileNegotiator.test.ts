import { describe, expect, it } from 'vitest'
import { ProfileNegotiator, type ProfileSpec } from './ProfileNegotiator.js'
import { get, mockReply, post } from './server.fixtures.js'

const SPEC_V1: ProfileSpec = { version: '1.0.0', urn: 'urn:command:chat.RenameRoom:1.0.0' }
const SPEC_V2: ProfileSpec = { version: '2.0.0', urn: 'urn:command:chat.RenameRoom:2.0.0' }
const SPEC_V1_1: ProfileSpec = { version: '1.1.0', urn: 'urn:command:chat.RenameRoom:1.1.0' }

describe('ProfileNegotiator', () => {
  describe('constructor', () => {
    it('asserts on empty specs', () => {
      expect(() => new ProfileNegotiator([], { varyTokens: [] })).toThrow(
        'at least one spec is required',
      )
    })

    it('asserts on duplicate URNs', () => {
      expect(
        () =>
          new ProfileNegotiator(
            [
              { version: '1.0.0', urn: 'urn:dup' },
              { version: '2.0.0', urn: 'urn:dup' },
            ],
            { varyTokens: [] },
          ),
      ).toThrow('duplicate URN')
    })

    it('sets latest to the highest version', () => {
      const neg = new ProfileNegotiator([SPEC_V1, SPEC_V2, SPEC_V1_1], {
        varyTokens: ['Content-Type'],
      })
      expect(neg.latest).toBe(SPEC_V2)
    })

    it('lists supported URNs in descending version order', () => {
      const neg = new ProfileNegotiator([SPEC_V1, SPEC_V1_1, SPEC_V2], {
        varyTokens: [],
      })
      expect(neg.supported).toEqual([SPEC_V2.urn, SPEC_V1_1.urn, SPEC_V1.urn])
    })
  })

  describe('appendVary', () => {
    it('sets Vary when none exists', () => {
      const mock = mockReply()
      ProfileNegotiator.appendVary(mock.reply, 'Accept', 'Accept-Profile')
      expect(mock.getHeaders()['vary']).toBe('Accept, Accept-Profile')
    })

    it('appends to existing Vary without duplicating', () => {
      const mock = mockReply()
      mock.reply.header('Vary', 'Accept')
      ProfileNegotiator.appendVary(mock.reply, 'Accept', 'Accept-Profile')
      expect(mock.getHeaders()['vary']).toBe('Accept, Accept-Profile')
    })

    it('handles empty existing Vary', () => {
      const mock = mockReply()
      ProfileNegotiator.appendVary(mock.reply, 'Content-Type')
      expect(mock.getHeaders()['vary']).toBe('Content-Type')
    })
  })

  describe('negotiate', () => {
    it('returns { kind: "none" } when no profile header is present', () => {
      const neg = new ProfileNegotiator([SPEC_V1], { varyTokens: [] })
      const { reply } = mockReply()

      const result = neg.negotiate(post({ 'content-type': 'application/json' }), reply)
      expect(result).toEqual({ kind: 'none' })
    })

    it('returns { kind: "matched" } for an exact URN match via Content-Profile', () => {
      const neg = new ProfileNegotiator([SPEC_V1, SPEC_V2], { varyTokens: [] })
      const { reply } = mockReply()

      const result = neg.negotiate(post({ 'content-profile': SPEC_V1.urn }), reply)
      expect(result).toEqual({ kind: 'matched', spec: SPEC_V1 })
    })

    it('returns first matching URN when multiple are requested', () => {
      const neg = new ProfileNegotiator([SPEC_V1, SPEC_V2], { varyTokens: [] })
      const { reply } = mockReply()

      const result = neg.negotiate(
        post({ 'content-profile': `${SPEC_V2.urn}, ${SPEC_V1.urn}` }),
        reply,
      )
      expect(result).toEqual({ kind: 'matched', spec: SPEC_V2 })
    })

    it('returns { kind: "replied" } and sends 406 when no URN matches', () => {
      const neg = new ProfileNegotiator([SPEC_V1], {
        varyTokens: ['Content-Type', 'Content-Profile'],
      })
      const mock = mockReply()

      const result = neg.negotiate(post({ 'content-profile': 'urn:unknown:1.0.0' }), mock.reply)
      expect(result).toEqual({ kind: 'replied' })
      expect(mock.getStatus()).toBe(406)
      expect(mock.getContentType()).toBe('application/json')

      const body = mock.getBody() as { error: string; requested: string[]; supported: string[] }
      expect(body.error).toBe('Not Acceptable')
      expect(body.requested).toEqual(['urn:unknown:1.0.0'])
      expect(body.supported).toEqual([SPEC_V1.urn])
    })

    it('sets Vary header on 406 response', () => {
      const neg = new ProfileNegotiator([SPEC_V1], {
        varyTokens: ['Content-Type', 'Content-Profile'],
      })
      const mock = mockReply()

      neg.negotiate(post({ 'content-profile': 'urn:no-match' }), mock.reply)
      expect(mock.getHeaders()['vary']).toBe('Content-Type, Content-Profile')
    })

    it('reads Accept-Profile for GET requests', () => {
      const neg = new ProfileNegotiator([SPEC_V1, SPEC_V2], { varyTokens: [] })
      const { reply } = mockReply()

      const result = neg.negotiate(get({ 'accept-profile': SPEC_V2.urn }), reply)
      expect(result).toEqual({ kind: 'matched', spec: SPEC_V2 })
    })

    it('reads Content-Type profile param for POST', () => {
      const neg = new ProfileNegotiator([SPEC_V1], { varyTokens: [] })
      const { reply } = mockReply()

      const result = neg.negotiate(
        post({ 'content-type': `application/json; profile="${SPEC_V1.urn}"` }),
        reply,
      )
      expect(result).toEqual({ kind: 'matched', spec: SPEC_V1 })
    })
  })

  describe('get', () => {
    it('returns spec by URN', () => {
      const neg = new ProfileNegotiator([SPEC_V1, SPEC_V2], { varyTokens: [] })
      expect(neg.get(SPEC_V1.urn)).toBe(SPEC_V1)
      expect(neg.get(SPEC_V2.urn)).toBe(SPEC_V2)
    })

    it('returns undefined for unknown URN', () => {
      const neg = new ProfileNegotiator([SPEC_V1], { varyTokens: [] })
      expect(neg.get('urn:nonexistent')).toBeUndefined()
    })
  })

  describe('applyHeaders', () => {
    it('sets Content-Profile, Link, and Vary headers', () => {
      const neg = new ProfileNegotiator([SPEC_V1], {
        varyTokens: ['Content-Type', 'Content-Profile'],
      })
      const mock = mockReply()

      neg.applyHeaders(mock.reply, SPEC_V1.urn)

      expect(mock.getHeaders()['content-profile']).toBe(SPEC_V1.urn)
      expect(mock.getHeaders()['link']).toBe(`<${SPEC_V1.urn}>; rel="profile"`)
      expect(mock.getHeaders()['vary']).toBe('Content-Type, Content-Profile')
    })
  })
})
