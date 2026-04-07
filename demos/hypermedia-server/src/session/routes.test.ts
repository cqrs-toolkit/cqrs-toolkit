import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../bootstrap.js'

describe('session routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    ;({ app } = createApp({ logLevel: 'silent' }))
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns new session when no cookie is present', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/session' })

    expect(res.statusCode).toBe(200)

    const body = res.json()
    expect(body.authenticated).toBe(true)
    expect(body.user.sub).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    expect(typeof body.expiresAtMs).toBe('number')

    const setCookie = res.headers['set-cookie']
    expect(setCookie).toContain(`demo_user_id=${body.user.sub}`)
    expect(setCookie).toContain('Path=/')
    expect(setCookie).toContain('SameSite=Lax')
    expect(setCookie).toContain('Max-Age=31536000')
  })

  it('returns same user when valid cookie is present', async () => {
    const first = await app.inject({ method: 'GET', url: '/api/auth/session' })
    const firstBody = first.json()
    const userId: string = firstBody.user.sub

    const second = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie: `demo_user_id=${userId}` },
    })
    const secondBody = second.json()

    expect(secondBody.user.sub).toBe(userId)
    expect(secondBody.expiresAtMs).toBeGreaterThanOrEqual(firstBody.expiresAtMs)
  })

  it('creates new user when cookie references unknown userId (stale after reset)', async () => {
    const first = await app.inject({ method: 'GET', url: '/api/auth/session' })
    const staleUserId: string = first.json().user.sub

    // Reset clears the user store
    await app.inject({ method: 'POST', url: '/api/test/reset' })

    const second = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie: `demo_user_id=${staleUserId}` },
    })
    const secondBody = second.json()

    expect(secondBody.user.sub).not.toBe(staleUserId)
    expect(secondBody.authenticated).toBe(true)
  })
})
