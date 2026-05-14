/**
 * Library-provided default {@link FailureMapper} implementations.
 *
 * - {@link defaultStatusMapper} — RFC 9110 status code → category, no body
 *   inspection. The single source of truth for the HTTP-only mapping; per
 *   the design pitfalls "for..await of N single-item calls" rule, all senders
 *   delegate to this rather than re-implementing the table.
 * - {@link defaultProblemJsonMapper} — RFC 9457 problem+json: lifts `type`
 *   into `errorCode`, falls through to `defaultStatusMapper` for category.
 *   Behaves identically to `defaultStatusMapper` when the body isn't a
 *   problem document.
 * - {@link defaultLdJsonMapper} — JSON-LD shape: lifts `@type` into
 *   `errorCode`, otherwise delegates to `defaultStatusMapper`.
 *
 * Consumers building against bespoke error formats supply their own
 * `FailureMapper`. Per-command `mapFailure` on `CommandHandlerRegistration`
 * is the sole arbiter when defined; otherwise `CqrsConfig.mapFailure` runs
 * (defaulting to `defaultProblemJsonMapper` since the project's canonical
 * error format is problem+json).
 */

import type {
  FailureCategory,
  FailureDescriptor,
  ServerErrorResponse,
} from '../../types/commands.js'

/**
 * RFC 9110 status code → {@link FailureCategory}, no body inspection.
 *
 * Following the strict reading of RFC 9110 / 9457 / 6585 / 8470 / 7725 /
 * 4918 / 5842, with the deliberate convention noted on 500 (treated as
 * `transient` because the field convention is to retry, despite RFC making
 * no such assertion) and on 404 (`requires-review` because on the
 * authoritative command path, 404 is definitive but typically means the
 * user's local read model was stale — surface to the user).
 */
export function defaultStatusMapper(response: ServerErrorResponse): FailureDescriptor {
  return { category: categoryForStatus(response.status) }
}

function categoryForStatus(status: number): FailureCategory {
  switch (status) {
    // Transient — retry per backoff config.
    case 408: // Request Timeout
    case 421: // Misdirected Request — retry on a different connection
    case 423: // Locked (WebDAV) — retry once lock clears
    case 425: // Too Early — TLS 1.3 0-RTT replay refusal
    case 429: // Too Many Requests — honour Retry-After
    case 500: // Internal Server Error — by convention; not RFC-asserted
    case 502: // Bad Gateway
    case 503: // Service Unavailable
    case 504: // Gateway Timeout
    case 507: // Insufficient Storage (WebDAV)
      return 'transient'

    // Requires-review — user can resolve.
    case 409: // Conflict
    case 412: // Precondition Failed (revision mismatch)
    case 422: // Unprocessable Content (business-rule rejection)
    case 404: // Not Found — definitive on command path; user's cache is likely stale
      return 'requires-review'

    // Unauthenticated — re-auth fixes it.
    case 401: // Unauthorized
    case 407: // Proxy Authentication Required
    case 511: // Network Authentication Required (captive portal)
      return 'unauthenticated'

    // Permission-denied — re-auth does not fix it.
    case 402: // Payment Required (closest UX shape)
    case 403: // Forbidden
    case 451: // Unavailable For Legal Reasons
      return 'permission-denied'

    // Permanent — bug-shaped or non-recoverable.
    case 400: // Bad Request — malformed request syntax (client bug)
    case 405: // Method Not Allowed
    case 406: // Not Acceptable
    case 410: // Gone — explicitly RFC-permanent
    case 411: // Length Required
    case 413: // Content Too Large (Retry-After variant not handled here)
    case 414: // URI Too Long
    case 415: // Unsupported Media Type
    case 416: // Range Not Satisfiable
    case 417: // Expectation Failed
    case 426: // Upgrade Required
    case 428: // Precondition Required
    case 431: // Request Header Fields Too Large
    case 501: // Not Implemented
    case 505: // HTTP Version Not Supported
    case 508: // Loop Detected (WebDAV)
      return 'permanent'

    default: {
      // Unknown 4xx/5xx. Conservative default — won't auto-retry, surfaces
      // to UI. 1xx/2xx/3xx don't reach here (status is from a failed send),
      // but include them as `permanent` defensively rather than throwing.
      return 'permanent'
    }
  }
}

/**
 * Problem+json (RFC 9457) — recognizes the document shape, lifts `type` into
 * `errorCode`, delegates to {@link defaultStatusMapper} for category. When
 * the body is not a problem document, behaves identically to
 * `defaultStatusMapper`.
 */
export function defaultProblemJsonMapper(response: ServerErrorResponse): FailureDescriptor {
  const base = defaultStatusMapper(response)
  const type = readProblemType(response.body)
  if (type === undefined) return base
  return {
    category: base.category,
    errorCode: type,
    details: response.body,
  }
}

/**
 * ld+json — recognizes JSON-LD shape, lifts `@type` (or `type`) into
 * `errorCode`, otherwise delegates to {@link defaultStatusMapper}.
 */
export function defaultLdJsonMapper(response: ServerErrorResponse): FailureDescriptor {
  const base = defaultStatusMapper(response)
  const type = readJsonLdType(response.body)
  if (type === undefined) return base
  return {
    category: base.category,
    errorCode: type,
    details: response.body,
  }
}

// ---------------------------------------------------------------------------
// Body-shape helpers — opt-in for consumer mappers that want to dispatch on
// problem+json or ld+json identifiers without writing the shape check.
// ---------------------------------------------------------------------------

/**
 * Read the `type` URI from a problem+json document. Returns undefined when
 * the body is not a problem document or `type` is missing/non-string.
 */
export function readProblemType(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const record = body as Record<string, unknown>
  const type = record['type']
  return typeof type === 'string' ? type : undefined
}

/**
 * Type-guard variant of {@link readProblemType} — returns true when the
 * problem+json `type` matches the expected URI.
 */
export function hasProblemType(body: unknown, expected: string): boolean {
  return readProblemType(body) === expected
}

/**
 * Read the `@type` (preferred) or `type` field from a JSON-LD document.
 * Returns undefined when neither is present or non-string. JSON-LD `@type`
 * can be an array; this helper returns the first string element in that case.
 */
export function readJsonLdType(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const record = body as Record<string, unknown>
  const atType = record['@type']
  if (typeof atType === 'string') return atType
  if (Array.isArray(atType)) {
    const first = atType.find((v): v is string => typeof v === 'string')
    if (first !== undefined) return first
  }
  const type = record['type']
  return typeof type === 'string' ? type : undefined
}

/**
 * Type-guard variant of {@link readJsonLdType}.
 */
export function hasJsonLdType(body: unknown, expected: string): boolean {
  return readJsonLdType(body) === expected
}
