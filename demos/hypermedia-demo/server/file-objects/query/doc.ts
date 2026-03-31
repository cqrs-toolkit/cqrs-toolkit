/**
 * FileObject query documentation — HAL definitions and class constants.
 */

import { HAL } from '@cqrs-toolkit/hypermedia'
import { FileObjectRepV1_0_0 } from './v1_0_0/representation.js'

export const FileObjectClass = 'storage:FileObject'

export const HalFileObjectCollection: HAL.CollectionDefinition = {
  itemClass: FileObjectClass,
  searchTemplate: {
    template: FileObjectRepV1_0_0.collectionTemplate,
  },
}

export const HalFileObject: HAL.ResourceDefinition = {
  class: FileObjectClass,
  idTemplate: FileObjectRepV1_0_0.resourceHref,
  collectionLink: { rel: 'collection', href: FileObjectRepV1_0_0.collectionHref },
}

// ── Event HAL definitions ──

export const FileObjectItemEventClass = 'storage:FileObjectItemEvent'
export const FileObjectAggregateEventClass = 'storage:FileObjectAggregateEvent'

export const HalFileObjectItemEventCollection: HAL.CollectionDefinition = {
  itemClass: FileObjectItemEventClass,
  searchTemplate: { template: FileObjectRepV1_0_0.itemEvents.template.template },
}

export const HalFileObjectItemEvent: HAL.ResourceDefinition = {
  class: FileObjectItemEventClass,
  idTemplate: `${FileObjectRepV1_0_0.itemEvents.hrefBase}/{eventId}`,
  collectionLink: { rel: 'collection', href: FileObjectRepV1_0_0.itemEvents.hrefBase },
}

export const HalFileObjectAggregateEventCollection: HAL.CollectionDefinition = {
  itemClass: FileObjectAggregateEventClass,
  searchTemplate: { template: FileObjectRepV1_0_0.aggregateEvents.template.template },
}

export const HalFileObjectAggregateEvent: HAL.ResourceDefinition = {
  class: FileObjectAggregateEventClass,
  idTemplate: `${FileObjectRepV1_0_0.aggregateEvents.hrefBase}/{eventId}`,
  collectionLink: { rel: 'collection', href: FileObjectRepV1_0_0.aggregateEvents.hrefBase },
}
