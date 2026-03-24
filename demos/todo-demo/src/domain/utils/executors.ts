import type { CommandHandlerRegistration, IAnticipatedEvent } from '@cqrs-toolkit/client'
import type { JSONSchema7 } from 'json-schema'

export type AppCommandHandlerRegistration<T extends IAnticipatedEvent = IAnticipatedEvent> =
  CommandHandlerRegistration<T, JSONSchema7>
