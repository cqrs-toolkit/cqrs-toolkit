/**
 * Generators that turn an HttpRow into a copy-pasteable command/snippet.
 *
 * Headers and body are taken from what the capture surfaced; bodies are
 * truncated to PAYLOAD_PREVIEW_BYTES upstream, so the output is best-effort
 * for reproduction.
 */

import type { HttpRow } from '../../stores/network.js'

/** POSIX shell single-quote: 'foo' → 'foo', won't include single quotes raw. */
function sq(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}

export function toCurl(row: HttpRow): string {
  const lines: string[] = [`curl ${sq(row.url)}`]
  if (row.method && row.method.toUpperCase() !== 'GET') {
    lines.push(`  -X ${row.method.toUpperCase()}`)
  }
  for (const [k, v] of Object.entries(row.requestHeaders ?? {})) {
    lines.push(`  -H ${sq(`${k}: ${v}`)}`)
  }
  if (row.requestBodyPreview !== undefined && row.requestBodyPreview.length > 0) {
    lines.push(`  --data-raw ${sq(row.requestBodyPreview)}`)
  }
  return lines.join(' \\\n')
}

export function toFetch(row: HttpRow): string {
  const init: Record<string, unknown> = {
    method: row.method.toUpperCase(),
    headers: row.requestHeaders ?? {},
  }
  if (row.requestBodyPreview !== undefined && row.requestBodyPreview.length > 0) {
    init.body = row.requestBodyPreview
  }
  return `await fetch(${JSON.stringify(row.url)}, ${JSON.stringify(init, null, 2)});`
}

export function toFetchNode(row: HttpRow): string {
  return [
    `// Node 18+ (global fetch).`,
    `const response = ${toFetch(row).replace(/^await /, 'await ')}`,
    `console.log(response.status, await response.text());`,
  ].join('\n')
}

export function toPowerShell(row: HttpRow): string {
  const headerObj = Object.entries(row.requestHeaders ?? {})
    .map(([k, v]) => `  '${k}' = ${JSON.stringify(v)}`)
    .join('\n')
  const bodyLine =
    row.requestBodyPreview !== undefined && row.requestBodyPreview.length > 0
      ? ` -Body ${JSON.stringify(row.requestBodyPreview)}`
      : ''
  return [
    `$headers = @{`,
    headerObj,
    `}`,
    `Invoke-WebRequest -Uri ${JSON.stringify(row.url)} -Method ${row.method.toUpperCase()} -Headers $headers${bodyLine}`,
  ].join('\n')
}

export function toHarFragment(row: HttpRow): string {
  const har = {
    startedDateTime: row.startedAt !== undefined ? new Date(row.startedAt).toISOString() : '',
    time: timeMs(row),
    request: {
      method: row.method.toUpperCase(),
      url: row.url,
      httpVersion: 'HTTP/1.1',
      headers: headerArray(row.requestHeaders ?? {}),
      queryString: queryString(row.url),
      bodySize: row.requestBodyPreview?.length ?? 0,
      postData:
        row.requestBodyPreview !== undefined
          ? {
              mimeType: row.requestHeaders?.['Content-Type'] ?? 'application/octet-stream',
              text: row.requestBodyPreview,
            }
          : undefined,
    },
    response: {
      status: row.status ?? 0,
      statusText: row.statusText ?? '',
      httpVersion: 'HTTP/1.1',
      headers: headerArray(row.responseHeaders ?? {}),
      content: {
        size: row.encodedDataLength ?? -1,
        mimeType: row.mimeType ?? '',
      },
      bodySize: row.encodedDataLength ?? -1,
    },
    serverIPAddress: row.remoteIpAddress ?? '',
    _source: row.source,
    _target: row.session.targetUrl,
  }
  return JSON.stringify(har, null, 2)
}

function timeMs(row: HttpRow): number {
  const end = row.finishedAt ?? row.failedAt ?? row.respondedAt
  if (row.startedAt === undefined || end === undefined) return 0
  return end - row.startedAt
}

function headerArray(headers: Record<string, string>): Array<{ name: string; value: string }> {
  return Object.entries(headers).map(([name, value]) => ({ name, value }))
}

function queryString(url: string): Array<{ name: string; value: string }> {
  try {
    const u = new URL(url)
    const out: Array<{ name: string; value: string }> = []
    u.searchParams.forEach((value, name) => out.push({ name, value }))
    return out
  } catch {
    return []
  }
}
