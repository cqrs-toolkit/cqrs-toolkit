/**
 * Unit tests for the library-provided default failure mappers and body-shape
 * helpers. Pure functions — no fixtures beyond synthetic ServerErrorResponse
 * values.
 */

import { describe, expect, it } from 'vitest'
import type { FailureCategory, ServerErrorResponse } from '../../types/commands.js'
import {
  defaultLdJsonMapper,
  defaultProblemJsonMapper,
  defaultStatusMapper,
  hasJsonLdType,
  hasProblemType,
  readJsonLdType,
  readProblemType,
} from './defaultMappers.js'

function makeResponse(
  status: number,
  body?: unknown,
  headers: Record<string, string> = {},
): ServerErrorResponse {
  return {
    status,
    headers: new Headers(headers),
    body,
  }
}

describe('defaultStatusMapper', () => {
  // Each row asserts `categoryForStatus` via the mapper's surface — keeps the
  // test in step with how consumers / the queue actually call the mapper.
  const cases: Array<{ status: number; expected: FailureCategory; note: string }> = [
    // Transient
    { status: 408, expected: 'transient', note: 'Request Timeout' },
    { status: 421, expected: 'transient', note: 'Misdirected Request' },
    { status: 423, expected: 'transient', note: 'Locked (WebDAV)' },
    { status: 425, expected: 'transient', note: 'Too Early' },
    { status: 429, expected: 'transient', note: 'Too Many Requests' },
    { status: 500, expected: 'transient', note: 'Internal Server Error (by convention)' },
    { status: 502, expected: 'transient', note: 'Bad Gateway' },
    { status: 503, expected: 'transient', note: 'Service Unavailable' },
    { status: 504, expected: 'transient', note: 'Gateway Timeout' },
    { status: 507, expected: 'transient', note: 'Insufficient Storage' },
    // Requires-review
    { status: 404, expected: 'requires-review', note: 'Not Found (authoritative command path)' },
    { status: 409, expected: 'requires-review', note: 'Conflict' },
    { status: 412, expected: 'requires-review', note: 'Precondition Failed' },
    { status: 422, expected: 'requires-review', note: 'Unprocessable Content' },
    // Unauthenticated
    { status: 401, expected: 'unauthenticated', note: 'Unauthorized' },
    { status: 407, expected: 'unauthenticated', note: 'Proxy Authentication Required' },
    { status: 511, expected: 'unauthenticated', note: 'Network Authentication Required' },
    // Permission-denied
    { status: 402, expected: 'permission-denied', note: 'Payment Required' },
    { status: 403, expected: 'permission-denied', note: 'Forbidden' },
    { status: 451, expected: 'permission-denied', note: 'Unavailable For Legal Reasons' },
    // Permanent
    { status: 400, expected: 'permanent', note: 'Bad Request' },
    { status: 405, expected: 'permanent', note: 'Method Not Allowed' },
    { status: 406, expected: 'permanent', note: 'Not Acceptable' },
    { status: 410, expected: 'permanent', note: 'Gone' },
    { status: 411, expected: 'permanent', note: 'Length Required' },
    { status: 413, expected: 'permanent', note: 'Content Too Large' },
    { status: 414, expected: 'permanent', note: 'URI Too Long' },
    { status: 415, expected: 'permanent', note: 'Unsupported Media Type' },
    { status: 416, expected: 'permanent', note: 'Range Not Satisfiable' },
    { status: 417, expected: 'permanent', note: 'Expectation Failed' },
    { status: 426, expected: 'permanent', note: 'Upgrade Required' },
    { status: 428, expected: 'permanent', note: 'Precondition Required' },
    { status: 431, expected: 'permanent', note: 'Request Header Fields Too Large' },
    { status: 501, expected: 'permanent', note: 'Not Implemented' },
    { status: 505, expected: 'permanent', note: 'HTTP Version Not Supported' },
    { status: 508, expected: 'permanent', note: 'Loop Detected' },
    // Catch-all
    { status: 418, expected: 'permanent', note: "I'm a teapot — unknown 4xx falls through" },
    { status: 599, expected: 'permanent', note: 'unknown 5xx falls through' },
  ]

  it.each(cases)('maps $status ($note) to $expected', ({ status, expected }) => {
    const descriptor = defaultStatusMapper(makeResponse(status))
    expect(descriptor.category).toBe(expected)
  })

  it('does not look at body or headers — status alone determines the category', () => {
    const a = defaultStatusMapper(makeResponse(409))
    const b = defaultStatusMapper(
      makeResponse(409, { type: 'urn:errors:foo' }, { 'retry-after': '5' }),
    )
    expect(a.category).toBe(b.category)
    expect(a.errorCode).toBeUndefined()
    expect(b.errorCode).toBeUndefined()
  })
})

describe('defaultProblemJsonMapper', () => {
  it('lifts the `type` URI from a problem document into errorCode', () => {
    const descriptor = defaultProblemJsonMapper(
      makeResponse(409, {
        type: 'urn:errors:title-already-taken',
        title: 'Title is already taken',
        detail: 'A todo with this title exists',
      }),
    )
    expect(descriptor.category).toBe('requires-review')
    expect(descriptor.errorCode).toBe('urn:errors:title-already-taken')
    expect(descriptor.details).toEqual({
      type: 'urn:errors:title-already-taken',
      title: 'Title is already taken',
      detail: 'A todo with this title exists',
    })
  })

  it('falls through to defaultStatusMapper when the body has no type', () => {
    const descriptor = defaultProblemJsonMapper(makeResponse(422, { detail: 'just a message' }))
    expect(descriptor.category).toBe('requires-review')
    expect(descriptor.errorCode).toBeUndefined()
    expect(descriptor.details).toBeUndefined()
  })

  it('falls through to defaultStatusMapper for non-object bodies', () => {
    const descriptor = defaultProblemJsonMapper(makeResponse(500, 'plain text'))
    expect(descriptor.category).toBe('transient')
    expect(descriptor.errorCode).toBeUndefined()
  })

  it('preserves the status-derived category even when type is set', () => {
    const descriptor = defaultProblemJsonMapper(
      makeResponse(403, { type: 'urn:errors:role-required' }),
    )
    expect(descriptor.category).toBe('permission-denied')
    expect(descriptor.errorCode).toBe('urn:errors:role-required')
  })

  it('ignores non-string `type` fields', () => {
    const descriptor = defaultProblemJsonMapper(makeResponse(409, { type: 12345 }))
    expect(descriptor.errorCode).toBeUndefined()
  })
})

describe('defaultLdJsonMapper', () => {
  it('reads `@type` (preferred) into errorCode', () => {
    const descriptor = defaultLdJsonMapper(
      makeResponse(409, { '@type': 'http://example.com/errors/Conflict' }),
    )
    expect(descriptor.errorCode).toBe('http://example.com/errors/Conflict')
    expect(descriptor.category).toBe('requires-review')
  })

  it('falls back to plain `type` when `@type` is absent', () => {
    const descriptor = defaultLdJsonMapper(
      makeResponse(409, { type: 'http://example.com/errors/Plain' }),
    )
    expect(descriptor.errorCode).toBe('http://example.com/errors/Plain')
  })

  it('takes the first string when `@type` is an array', () => {
    const descriptor = defaultLdJsonMapper(
      makeResponse(422, { '@type': ['http://example.com/errors/A', 'Other'] }),
    )
    expect(descriptor.errorCode).toBe('http://example.com/errors/A')
  })

  it('falls through to status when neither `@type` nor `type` is present', () => {
    const descriptor = defaultLdJsonMapper(makeResponse(403, { '@id': 'foo' }))
    expect(descriptor.category).toBe('permission-denied')
    expect(descriptor.errorCode).toBeUndefined()
  })
})

describe('readProblemType', () => {
  it('returns the type string when present', () => {
    expect(readProblemType({ type: 'urn:foo' })).toBe('urn:foo')
  })

  it('returns undefined for non-string type', () => {
    expect(readProblemType({ type: 42 })).toBeUndefined()
  })

  it('returns undefined for non-object body', () => {
    expect(readProblemType('string body')).toBeUndefined()
    expect(readProblemType(null)).toBeUndefined()
    expect(readProblemType(undefined)).toBeUndefined()
  })
})

describe('hasProblemType', () => {
  it('matches the expected URI', () => {
    expect(hasProblemType({ type: 'urn:foo' }, 'urn:foo')).toBe(true)
    expect(hasProblemType({ type: 'urn:foo' }, 'urn:bar')).toBe(false)
  })

  it('returns false for missing or non-string type', () => {
    expect(hasProblemType({}, 'urn:foo')).toBe(false)
    expect(hasProblemType({ type: 42 }, 'urn:foo')).toBe(false)
  })
})

describe('readJsonLdType', () => {
  it('prefers `@type` over `type`', () => {
    expect(readJsonLdType({ '@type': 'A', type: 'B' })).toBe('A')
  })

  it('takes first string element of @type array', () => {
    expect(readJsonLdType({ '@type': ['A', 'B'] })).toBe('A')
  })

  it('skips non-string entries when @type is mixed', () => {
    expect(readJsonLdType({ '@type': [42, 'A'] })).toBe('A')
  })

  it('returns undefined for empty array @type', () => {
    expect(readJsonLdType({ '@type': [] })).toBeUndefined()
  })

  it('returns undefined for null/non-object', () => {
    expect(readJsonLdType(null)).toBeUndefined()
    expect(readJsonLdType('s')).toBeUndefined()
  })
})

describe('hasJsonLdType', () => {
  it('matches the expected type via @type or type', () => {
    expect(hasJsonLdType({ '@type': 'A' }, 'A')).toBe(true)
    expect(hasJsonLdType({ type: 'B' }, 'B')).toBe(true)
    expect(hasJsonLdType({ '@type': 'A' }, 'B')).toBe(false)
  })
})
