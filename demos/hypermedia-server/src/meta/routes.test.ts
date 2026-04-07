import type { HydraApiDocumentation } from '@cqrs-toolkit/hypermedia'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../bootstrap.js'

let app: FastifyInstance

beforeAll(async () => {
  ;({ app } = createApp({ logLevel: 'silent' }))
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

describe('GET /api/meta/apidoc', () => {
  it('returns valid JSON-LD with correct content type', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/meta/apidoc' })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/ld+json')

    const body = res.json()
    expect(body['@type']).toBe('hydra:ApiDocumentation')
    expect(body['hydra:supportedClass']).toBeDefined()
    expect(Array.isArray(body['hydra:supportedClass'])).toBe(true)
  })

  it('contains expected command URNs', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/meta/apidoc' })
    const body = res.json()
    const json = JSON.stringify(body)

    expect(json).toContain('urn:command:nb.CreateTodo:1.0.0')
    expect(json).toContain('urn:command:nb.UpdateTodoContent:1.0.0')
    expect(json).toContain('urn:command:nb.CreateNote:1.0.0')
    expect(json).toContain('urn:command:nb.CreateNotebook:1.0.0')
  })

  it('contains expected representation profiles', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/meta/apidoc' })
    const json = JSON.stringify(res.json())

    expect(json).toContain('urn:profile:nb.Todo:1.0.0')
    expect(json).toContain('urn:profile:nb.TodoCollection:1.0.0')
    expect(json).toContain('urn:profile:nb.Note:1.0.0')
    expect(json).toContain('urn:profile:nb.Notebook:1.0.0')
  })

  it('returns ETag header', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/meta/apidoc' })

    expect(res.headers['etag']).toBeDefined()
    expect(typeof res.headers['etag']).toBe('string')
  })

  it('returns 304 when If-None-Match matches ETag', async () => {
    const first = await app.inject({ method: 'GET', url: '/api/meta/apidoc' })
    const etag = first.headers['etag'] as string

    const second = await app.inject({
      method: 'GET',
      url: '/api/meta/apidoc',
      headers: { 'if-none-match': etag },
    })

    expect(second.statusCode).toBe(304)
  })

  it('returns 200 when If-None-Match does not match', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/meta/apidoc',
      headers: { 'if-none-match': '"stale-etag"' },
    })

    expect(res.statusCode).toBe(200)
  })
})

describe('schema discovery via apidoc', () => {
  it('fetches a command schema referenced by the apidoc', async () => {
    const apidocRes = await app.inject({ method: 'GET', url: '/api/meta/apidoc' })
    const apidoc = apidocRes.json()

    // Find the CreateTodo command's jsonSchema URL
    const schemaUrl = findJsonSchemaUrl(apidoc, 'urn:command:nb.CreateTodo:1.0.0')
    expect(schemaUrl).toBeDefined()

    // Convert absolute URL to relative path for inject
    const path = new URL(schemaUrl).pathname
    const schemaRes = await app.inject({ method: 'GET', url: path })

    expect(schemaRes.statusCode).toBe(200)
    expect(schemaRes.headers['content-type']).toContain('application/schema+json')

    const schema = schemaRes.json()
    expect(schema.type).toBe('object')
    expect(schema.properties).toHaveProperty('content')
    expect(schema.required).toContain('content')
  })

  it('fetches a command envelope schema with nested data schema', async () => {
    const apidocRes = await app.inject({ method: 'GET', url: '/api/meta/apidoc' })
    const apidoc = apidocRes.json()

    const schemaUrl = findJsonSchemaUrl(apidoc, 'urn:command:nb.UpdateTodoContent:1.0.0')
    expect(schemaUrl).toBeDefined()

    const path = new URL(schemaUrl).pathname
    const schemaRes = await app.inject({ method: 'GET', url: path })

    expect(schemaRes.statusCode).toBe(200)
    const schema = schemaRes.json()
    expect(schema.type).toBe('object')
    expect(schema.properties).toHaveProperty('type')
    expect(schema.properties).toHaveProperty('data')
    expect(schema.properties).toHaveProperty('revision')
  })
})

describe('GET /api/meta/schemas/*', () => {
  it('returns immutable cache headers', async () => {
    const apidocRes = await app.inject({ method: 'GET', url: '/api/meta/apidoc' })
    const apidoc = apidocRes.json()
    const schemaUrl = findJsonSchemaUrl(apidoc, 'urn:command:nb.CreateTodo:1.0.0')
    const path = new URL(schemaUrl).pathname

    const res = await app.inject({ method: 'GET', url: path })

    expect(res.headers['cache-control']).toContain('immutable')
    expect(res.headers['cache-control']).toContain('max-age=31536000')
  })

  it('returns 404 for nonexistent schema', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/meta/schemas/urn/schema/does.NotExist/1.0.0.json',
    })

    expect(res.statusCode).toBe(404)
  })
})

describe('GET /api/meta/openapi', () => {
  it('returns valid OpenAPI 3.1 document with correct content type', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/meta/openapi' })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/json')

    const body = res.json()
    expect(body.openapi).toBe('3.1.0')
    expect(body.info).toBeDefined()
    expect(body.paths).toBeDefined()
  })

  it('contains resolved schema URLs, not URNs', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/meta/openapi' })
    const json = JSON.stringify(res.json())

    // No bare URN $refs should remain
    expect(json).not.toContain('"$ref":"urn:')
    // Resolved URLs should be present
    expect(json).toContain('/api/meta/schemas/')
  })

  it('schema $ref resolves to a serveable schema endpoint', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/meta/openapi' })
    const doc = res.json()

    // Find a $ref in the create command's request body
    const createPath = doc.paths?.['/api/todos']
    const postOp = createPath?.post
    expect(postOp).toBeDefined()

    const schemaRef =
      postOp?.requestBody?.content?.['application/json']?.schema?.$ref ??
      postOp?.requestBody?.content?.['application/json']?.schema?.oneOf?.[0]?.$ref
    expect(schemaRef).toBeDefined()

    // Fetch the schema the $ref points to
    const schemaPath = new URL(schemaRef).pathname
    const schemaRes = await app.inject({ method: 'GET', url: schemaPath })

    expect(schemaRes.statusCode).toBe(200)
    expect(schemaRes.headers['content-type']).toContain('application/schema+json')

    const schema = schemaRes.json()
    expect(schema.type).toBe('object')
  })

  it('returns ETag and supports conditional requests', async () => {
    const first = await app.inject({ method: 'GET', url: '/api/meta/openapi' })
    expect(first.headers['etag']).toBeDefined()

    const second = await app.inject({
      method: 'GET',
      url: '/api/meta/openapi',
      headers: { 'if-none-match': first.headers['etag'] as string },
    })
    expect(second.statusCode).toBe(304)
  })
})

// --- Helpers ---

/**
 * Walk the apidoc JSON-LD to find the svc:jsonSchema URL for a command URN.
 */
function findJsonSchemaUrl(apidoc: HydraApiDocumentation.Document, commandUrn: string): string {
  const classes = apidoc['hydra:supportedClass']
  for (const cls of classes) {
    const cmds = cls['svc:commands']
    if (!cmds) continue
    const supported = cmds['svc:supportedCommand']
    for (const cmd of supported) {
      if (cmd['@id'] === commandUrn) {
        if (cmd['svc:jsonSchema']) return cmd['svc:jsonSchema']
        else throw new Error(`Command ${commandUrn} does not have a svc:jsonSchema value`)
      }
    }
  }
  throw new Error(`Command ${commandUrn} not found in apidoc`)
}
