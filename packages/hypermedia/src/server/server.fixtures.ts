import { FastifyReply } from 'fastify'
import type { ReqLike } from '../utils.js'

export function mockReply() {
  const headers: Record<string, string> = {}
  let statusCode: number | undefined
  let sentBody: unknown

  const reply = {
    code(code: number) {
      statusCode = code
      return reply
    },
    type(type: string) {
      headers['content-type'] = type
      return reply
    },
    header(name: string, value: string) {
      headers[name.toLowerCase()] = value
      return reply
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()]
    },
    send(data: unknown) {
      sentBody = data
      return reply
    },
  }

  return {
    reply: reply as unknown as FastifyReply,
    getStatus: () => statusCode,
    getBody: () => sentBody,
    getContentType: () => headers['content-type'],
    getHeaders: () => headers,
  }
}

export function post(headers: Record<string, string | string[] | undefined> = {}): ReqLike {
  return { method: 'POST', headers }
}

export function get(headers: Record<string, string | string[] | undefined> = {}): ReqLike {
  return { method: 'GET', headers }
}
