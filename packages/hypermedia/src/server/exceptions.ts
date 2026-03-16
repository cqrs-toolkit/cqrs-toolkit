import { Exception } from '@meticoeus/ddd-es'

// 4xx
export class BadRequestException extends Exception {
  constructor(message: string, details?: unknown) {
    super('BadRequestException', message, 400)
    if (details !== undefined) {
      this._details = details
    }
  }
}

export class ForbiddenException extends Exception {
  constructor(message = 'Forbidden', details?: unknown) {
    super('ForbiddenException', message, 403)
    if (details !== undefined) {
      this._details = details
    }
  }
}

export class NotFoundException extends Exception {
  constructor(message = 'Not Found', details?: unknown) {
    super('NotFoundException', message, 404)
    if (details !== undefined) {
      this._details = details
    }
  }
}

export class TooManyIncludesException extends BadRequestException {
  constructor(max: number, tokens: string[]) {
    super(`Too many includes (max ${max})`, { requested: tokens.length, max, tokens })
  }
}

// 5xx
export class InternalErrorException extends Exception {
  constructor(message = 'Internal error', details?: unknown) {
    super('InternalErrorException', message, 500)
    if (details !== undefined) {
      this._details = details
    }
  }
}

export class BadGatewayException extends Exception {
  constructor(message = 'Upstream failure', details?: unknown) {
    super('BadGatewayException', message, 502)
    if (details !== undefined) {
      this._details = details
    }
  }
}

export class GatewayTimeoutException extends Exception {
  constructor(message = 'Upstream timeout', details?: unknown) {
    super('GatewayTimeoutException', message, 504)
    if (details !== undefined) {
      this._details = details
    }
  }
}

// Helper to map common Node/network errors to specific Exceptions.
export function toUpstreamException(err: any) {
  const code = err?.code
  if (code === 'ETIMEDOUT') return new GatewayTimeoutException(err.message)
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET') return new BadGatewayException(err.message)
  return new InternalErrorException(err?.message ?? String(err))
}
