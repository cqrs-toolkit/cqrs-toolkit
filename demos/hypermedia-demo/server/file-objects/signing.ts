/**
 * HMAC signing for presigned upload forms.
 *
 * Mirrors the S3 presigned-post pattern: the server signs the form fields,
 * and the upload endpoint verifies the signature to prevent tampering.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

const SIGNING_KEY = 'demo-file-upload-signing-key'

export function signFields(fields: Record<string, string>): string {
  const payload = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('&')
  return createHmac('sha256', SIGNING_KEY).update(payload).digest('hex')
}

export function verifySignature(fields: Record<string, string>, signature: string): boolean {
  const expected = signFields(fields)
  if (expected.length !== signature.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}
