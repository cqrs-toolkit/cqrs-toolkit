import type { Querystring } from '../shared-types.js'
import type { HypermediaTypes } from '../types.js'

export interface RequestedCollectionMeta {
  total: boolean
  counts: boolean
}

export interface ResolvedCollectionMeta<Counts extends object = Record<string, any>> {
  total?: number | undefined
  counts?: Counts | undefined
}

export interface IncludeMetaCollectionSchema {
  type: string
  enum: readonly string[]
  errorMessage: {
    enum: string
  }
}

export namespace MetaInclude {
  export const TOTAL = 'total'
  export const COUNTS = 'counts'
  export const COUNTS_ITEMS = 'counts:items'
}

/**
 * Included by default:
 * * MetaInclude.TOTAL - 'total'
 *
 * Excluded by default:
 * * MetaInclude.COUNTS - 'counts'
 * * MetaInclude.COUNTS_ITEMS - 'counts:items'
 */
export const includeMetaCollectionList: readonly string[] = [MetaInclude.TOTAL]

export type IncludeMetaCollectionList = typeof MetaInclude.TOTAL

export const includeMetaCollectionSchema: IncludeMetaCollectionSchema =
  buildIncludeSchema(includeMetaCollectionList)

export function buildIncludeSchema(list: readonly string[]) {
  return {
    type: 'string',
    enum: list,
    errorMessage: {
      enum: `Allowed values are: [${list.join(', ')}].`,
    },
  }
}

export function getRequestedCollectionMeta(query: Querystring): RequestedCollectionMeta {
  const include = query?.include
  const meta: RequestedCollectionMeta = {
    total: false,
    counts: false,
  }

  if (typeof include === 'string') {
    switch (include) {
      case 'counts':
        meta.counts = true
        break
      case 'total':
        meta.total = true
        break
    }
  } else if (Array.isArray(include)) {
    meta.counts = include.includes('counts')
    meta.total = include.includes('total')
  }

  return meta
}

export function addCountsToResourceDescriptor(
  key: string,
  rd: HypermediaTypes.ResourceDescriptor,
  itemMap: Map<string, HypermediaTypes.ResourceDescriptor | undefined> | null | undefined,
) {
  if (itemMap) {
    const item = itemMap.get(key)
    if (item) {
      rd.properties._counts = item.properties
    }
  }
}
