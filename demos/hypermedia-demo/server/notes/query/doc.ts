/**
 * Note query documentation — HAL definitions and class constants.
 */

import { HAL } from '@cqrs-toolkit/hypermedia'
import { NoteRepV1_0_0 } from './v1_0_0/representation.js'

export const NoteClass = 'nb:Note'

export const HalNoteCollection: HAL.CollectionDefinition = {
  itemClass: NoteClass,
  searchTemplate: {
    template: NoteRepV1_0_0.collectionTemplate,
  },
}

export const HalNote: HAL.ResourceDefinition = {
  class: NoteClass,
  idTemplate: NoteRepV1_0_0.resourceHref,
  collectionLink: { rel: 'collection', href: NoteRepV1_0_0.collectionHref },
}

// ── Event HAL definitions ──

export const NoteItemEventClass = 'nb:NoteItemEvent'
export const NoteAggregateEventClass = 'nb:NoteAggregateEvent'

export const HalNoteItemEventCollection: HAL.CollectionDefinition = {
  itemClass: NoteItemEventClass,
  searchTemplate: { template: NoteRepV1_0_0.itemEvents.template.template },
}

export const HalNoteItemEvent: HAL.ResourceDefinition = {
  class: NoteItemEventClass,
  idTemplate: `${NoteRepV1_0_0.itemEvents.hrefBase}/{eventId}`,
  collectionLink: { rel: 'collection', href: NoteRepV1_0_0.itemEvents.hrefBase },
}

export const HalNoteAggregateEventCollection: HAL.CollectionDefinition = {
  itemClass: NoteAggregateEventClass,
  searchTemplate: { template: NoteRepV1_0_0.aggregateEvents.template.template },
}

export const HalNoteAggregateEvent: HAL.ResourceDefinition = {
  class: NoteAggregateEventClass,
  idTemplate: `${NoteRepV1_0_0.aggregateEvents.hrefBase}/{eventId}`,
  collectionLink: { rel: 'collection', href: NoteRepV1_0_0.aggregateEvents.hrefBase },
}
