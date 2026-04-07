export interface ResolvedDocument {
  /** Compact canonical JSON (sorted keys, no indentation) */
  content: string
  /** SHA-256 hex digest of content */
  etag: string
}
