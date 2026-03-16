export type Querystring = Record<string, string | string[]> | undefined

export namespace CursorPagination {
  export interface Connection<T, Counts extends object = Record<string, any>> {
    entities: T[]
    nextCursor: string | null
    prevCursor?: string | null
    total?: number | null
    counts?: Counts
  }
}

export namespace EventCursorPagination {
  export interface Connection<T> {
    entities: T[]
    nextCursor: string | null
    prevCursor?: string | null
    total?: number | null
  }
}
