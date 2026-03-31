/**
 * File resource URL helpers — encodes/decodes file paths as s3:// locators.
 *
 * Mirrors the event-sourcing project's FileObjectApplicationUtils.encodeS3Locator
 * and parseS3Locator, adapted for local temp file storage.
 */

/** A resource locator in s3:// format pointing to a file on disk. */
export type FileResourceURL = string

export function encodeFileResource(filePath: string): FileResourceURL {
  return `s3:///${encodeURIComponent(filePath)}`
}

export function parseFileResource(resource: FileResourceURL): string {
  const u = new URL(resource)
  if (u.protocol !== 's3:') throw new Error(`Unsupported scheme: ${u.protocol}`)
  return decodeURIComponent(u.pathname.slice(1))
}
