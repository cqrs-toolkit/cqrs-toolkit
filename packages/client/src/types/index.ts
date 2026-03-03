/**
 * Type exports for the CQRS Client library.
 */

// Events
export type {
  AnticipatedEvent,
  AnticipatedEventMeta,
  AnyEvent,
  BaseEvent,
  BaseEventMeta,
  EventMeta,
  EventPersistence,
  LibraryEvent,
  LibraryEventPayloads,
  LibraryEventType,
  PermanentEventMeta,
  ServerEvent,
  StatefulEventMeta,
} from './events.js'

export {
  isAnticipatedEvent,
  isPermanentEvent,
  isStatefulEvent,
  normalizeEventPersistence,
} from './events.js'

// Validation
export type { ValidationError, ValidationResult } from './validation.js'

export {
  createValidationError,
  isValidationFailure,
  isValidationSuccess,
  validationFailure,
  validationSuccess,
} from './validation.js'

// Domain
export type {
  DomainExecutionFailure,
  DomainExecutionResult,
  DomainExecutionSuccess,
  IDomainExecutor,
  PostProcessPlan,
} from './domain.js'

export { domainFailure, domainSuccess, isDomainFailure, isDomainSuccess } from './domain.js'

// Commands
export type {
  CommandCompletionResult,
  CommandError,
  CommandErrorSource,
  CommandEvent,
  CommandEventType,
  CommandFilter,
  CommandRecord,
  CommandStatus,
  CompletionCancelled,
  CompletionFailed,
  CompletionSucceeded,
  CompletionTimeout,
  EnqueueAndWaitFailure,
  EnqueueAndWaitOptions,
  EnqueueAndWaitResult,
  EnqueueAndWaitSuccess,
  EnqueueCommand,
  EnqueueFailure,
  EnqueueOptions,
  EnqueueResult,
  EnqueueSuccess,
  WaitOptions,
} from './commands.js'

export { isEnqueueFailure, isEnqueueSuccess, isTerminalStatus } from './commands.js'

// Config
export type {
  CacheConfig,
  CollectionConfig,
  CqrsClientConfig,
  ExecutionMode,
  ExecutionModeConfig,
  NetworkConfig,
  ResolvedConfig,
  RetryConfig,
  SqliteVfsType,
  StorageConfig,
} from './config.js'

export { DEFAULT_CONFIG, resolveConfig } from './config.js'

// Re-export ICommandSender from config's dependency for convenience
export type { ICommandSender } from '../core/command-queue/types.js'
