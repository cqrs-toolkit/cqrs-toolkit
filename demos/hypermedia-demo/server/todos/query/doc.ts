/**
 * Todo query documentation — HAL definitions and class constants.
 */

import { HAL } from '@cqrs-toolkit/hypermedia'
import { TodoRepV1_0_0 } from './v1_0_0/representation.js'

export const TodoClass = 'demo:Todo'

export const HalTodoCollection: HAL.CollectionDefinition = {
  itemClass: TodoClass,
  searchTemplate: {
    template: TodoRepV1_0_0.collectionTemplate,
  },
}

export const HalTodo: HAL.ResourceDefinition = {
  class: TodoClass,
  idTemplate: TodoRepV1_0_0.resourceHref,
  collectionLink: { rel: 'collection', href: TodoRepV1_0_0.collectionHref },
}

// ── Event HAL definitions ──

export const TodoItemEventClass = 'demo:TodoItemEvent'
export const TodoAggregateEventClass = 'demo:TodoAggregateEvent'

export const HalTodoItemEventCollection: HAL.CollectionDefinition = {
  itemClass: TodoItemEventClass,
  searchTemplate: { template: TodoRepV1_0_0.itemEvents.template.template },
}

export const HalTodoItemEvent: HAL.ResourceDefinition = {
  class: TodoItemEventClass,
  idTemplate: `${TodoRepV1_0_0.itemEvents.hrefBase}/{eventId}`,
  collectionLink: { rel: 'collection', href: TodoRepV1_0_0.itemEvents.hrefBase },
}

export const HalTodoAggregateEventCollection: HAL.CollectionDefinition = {
  itemClass: TodoAggregateEventClass,
  searchTemplate: { template: TodoRepV1_0_0.aggregateEvents.template.template },
}

export const HalTodoAggregateEvent: HAL.ResourceDefinition = {
  class: TodoAggregateEventClass,
  idTemplate: `${TodoRepV1_0_0.aggregateEvents.hrefBase}/{eventId}`,
  collectionLink: { rel: 'collection', href: TodoRepV1_0_0.aggregateEvents.hrefBase },
}
