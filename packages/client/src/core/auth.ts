/**
 * Auth strategy for transport-level authentication.
 *
 * Consumers implement this interface to control how auth headers are sent
 * with HTTP requests and how WebSocket connections are authenticated.
 * All hooks are optional — omitting a hook means no auth action for that transport.
 */
export interface AuthStrategy {
  /** Called before every HTTP fetch (seed, gap repair). Returns headers to merge. */
  getHttpHeaders?(): Promise<Record<string, string>>
  /** Called before `new WebSocket()`. Returns the final URL (append tokens, tickets, etc.). */
  prepareWebSocketUrl?(url: string): Promise<string>
  /** Called after `onopen`, before application messages. Resolve when auth is complete. Reject to abort and trigger reconnect. */
  authenticateWebSocket?(socket: WebSocket): Promise<void>
}

/**
 * Cookie-based auth strategy — all hooks are noop.
 *
 * The browser sends cookies automatically with both fetch() and WebSocket connections,
 * so no explicit auth handling is needed.
 */
export const cookieAuthStrategy: AuthStrategy = Object.freeze({})
