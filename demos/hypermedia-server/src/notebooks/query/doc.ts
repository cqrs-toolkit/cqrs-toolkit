/**
 * Notebook query documentation — HAL definitions and class constants.
 */

import { HAL } from '@cqrs-toolkit/hypermedia'
import { NotebookRepV1_0_0 } from './v1_0_0/representation.js'

export const NotebookClass = 'nb:Notebook'

export const HalNotebookCollection: HAL.CollectionDefinition = {
  itemClass: NotebookClass,
  searchTemplate: {
    template: NotebookRepV1_0_0.collectionTemplate,
  },
}

export const HalNotebook: HAL.ResourceDefinition = {
  class: NotebookClass,
  idTemplate: NotebookRepV1_0_0.resourceHref,
  collectionLink: { rel: 'collection', href: NotebookRepV1_0_0.collectionHref },
}

// ── Event HAL definitions ──

export const NotebookItemEventClass = 'nb:NotebookItemEvent'
export const NotebookAggregateEventClass = 'nb:NotebookAggregateEvent'

export const HalNotebookItemEventCollection: HAL.CollectionDefinition = {
  itemClass: NotebookItemEventClass,
  searchTemplate: { template: NotebookRepV1_0_0.itemEvents.template.template },
}

export const HalNotebookItemEvent: HAL.ResourceDefinition = {
  class: NotebookItemEventClass,
  idTemplate: `${NotebookRepV1_0_0.itemEvents.hrefBase}/{eventId}`,
  collectionLink: { rel: 'collection', href: NotebookRepV1_0_0.itemEvents.hrefBase },
}

export const HalNotebookAggregateEventCollection: HAL.CollectionDefinition = {
  itemClass: NotebookAggregateEventClass,
  searchTemplate: { template: NotebookRepV1_0_0.aggregateEvents.template.template },
}

export const HalNotebookAggregateEvent: HAL.ResourceDefinition = {
  class: NotebookAggregateEventClass,
  idTemplate: `${NotebookRepV1_0_0.aggregateEvents.hrefBase}/{eventId}`,
  collectionLink: { rel: 'collection', href: NotebookRepV1_0_0.aggregateEvents.hrefBase },
}
