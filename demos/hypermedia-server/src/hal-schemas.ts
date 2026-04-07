/**
 * Shared HAL _links schema blocks for response schemas.
 *
 * These are identical across all representations in the demo.
 * The real app may need custom _links entries — at that point,
 * consider packaging these in the hypermedia library.
 */

import type { JSONSchema7 } from 'json-schema'

export const halLink: JSONSchema7 = {
  type: 'object',
  properties: { href: { type: 'string' } },
  required: ['href'],
}

const templatedHalLink: JSONSchema7 = {
  type: 'object',
  properties: { href: { type: 'string' }, templated: { type: 'boolean' } },
  required: ['href'],
}

/** _links for a single resource: self + collection */
export const halResourceLinks: JSONSchema7 = {
  $id: 'urn:schema:hal:ResourceLinks:1.0.0',
  type: 'object',
  properties: {
    self: halLink,
    collection: halLink,
  },
  required: ['self'],
}

/** _links for a collection: self + pagination + search */
export const halCollectionLinks: JSONSchema7 = {
  $id: 'urn:schema:hal:CollectionLinks:1.0.0',
  type: 'object',
  properties: {
    self: halLink,
    first: halLink,
    prev: halLink,
    next: halLink,
    search: templatedHalLink,
  },
  required: ['self'],
}
