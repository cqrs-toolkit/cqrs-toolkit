import { Exception, Result } from '@meticoeus/ddd-es'
import { SchemaException } from './types.js'

export function prettyErrorResult(res: Result<unknown, unknown>): string {
  if (res.ok) return ''
  if (res.error instanceof SchemaException) {
    return [res.error.name, ...(res.error.details?.map(renderDetails) ?? [])].join('\n') ?? ''
  }
  if (res.error instanceof Exception) {
    if (Array.isArray(res.error.details)) {
      return [res.error.name, ...(res.error.details?.map(renderDetails) ?? [])].join('\n') ?? ''
    } else {
      return res.error.name
    }
  }
  return String(res.error)
}

function renderDetails(e: any) {
  if (typeof e?.path === 'string' && typeof e?.message === 'string') {
    return `${e.path}: ${e.message}`
  }
  return String(e)
}
