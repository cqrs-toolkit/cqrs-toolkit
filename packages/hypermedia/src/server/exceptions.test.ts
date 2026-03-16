import { describe, expect, it } from 'vitest'
import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  GatewayTimeoutException,
  InternalErrorException,
  NotFoundException,
  TooManyIncludesException,
  toUpstreamException,
} from './exceptions.js'

describe('exception classes', () => {
  it('BadRequestException has code 400', () => {
    const e = new BadRequestException('bad input')
    expect(e.code).toBe(400)
    expect(e.message).toBe('bad input')
    expect(e.name).toBe('BadRequestException')
  })

  it('ForbiddenException has code 403 with default message', () => {
    const e = new ForbiddenException()
    expect(e.code).toBe(403)
    expect(e.message).toBe('Forbidden')
  })

  it('NotFoundException has code 404', () => {
    const e = new NotFoundException()
    expect(e.code).toBe(404)
    expect(e.message).toBe('Not Found')
  })

  it('TooManyIncludesException has code 400 and details', () => {
    const e = new TooManyIncludesException(3, ['a', 'b', 'c', 'd'])
    expect(e.code).toBe(400)
    expect(e.details).toEqual({ requested: 4, max: 3, tokens: ['a', 'b', 'c', 'd'] })
  })

  it('InternalErrorException has code 500', () => {
    const e = new InternalErrorException()
    expect(e.code).toBe(500)
    expect(e.message).toBe('Internal error')
  })

  it('BadGatewayException has code 502', () => {
    const e = new BadGatewayException()
    expect(e.code).toBe(502)
    expect(e.message).toBe('Upstream failure')
  })

  it('GatewayTimeoutException has code 504', () => {
    const e = new GatewayTimeoutException()
    expect(e.code).toBe(504)
    expect(e.message).toBe('Upstream timeout')
  })

  it('exceptions store details when provided', () => {
    const e = new BadRequestException('msg', { foo: 1 })
    expect(e.details).toEqual({ foo: 1 })
  })

  it('exceptions omit details when not provided', () => {
    const e = new BadRequestException('msg')
    expect(e.details).toBeUndefined()
  })
})

describe('toUpstreamException', () => {
  it('maps ETIMEDOUT to GatewayTimeoutException', () => {
    const result = toUpstreamException({ code: 'ETIMEDOUT', message: 'timeout' })
    expect(result).toBeInstanceOf(GatewayTimeoutException)
    expect(result.message).toBe('timeout')
  })

  it('maps ECONNREFUSED to BadGatewayException', () => {
    const result = toUpstreamException({ code: 'ECONNREFUSED', message: 'refused' })
    expect(result).toBeInstanceOf(BadGatewayException)
  })

  it('maps ECONNRESET to BadGatewayException', () => {
    const result = toUpstreamException({ code: 'ECONNRESET', message: 'reset' })
    expect(result).toBeInstanceOf(BadGatewayException)
  })

  it('maps unknown errors to InternalErrorException', () => {
    const result = toUpstreamException({ message: 'oops' })
    expect(result).toBeInstanceOf(InternalErrorException)
    expect(result.message).toBe('oops')
  })

  it('handles errors without message', () => {
    const result = toUpstreamException({})
    expect(result).toBeInstanceOf(InternalErrorException)
  })
})
