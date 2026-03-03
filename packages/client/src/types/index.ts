/**
 * Type exports for the CQRS Client library.
 */

// Events
export type {
  AnticipatedEvent,
  AnticipatedEventMeta,
  EventPersistence,
  LibraryEvent,
  LibraryEventPayloads,
  LibraryEventType,
} from './events.js'

export { hydrateSerializedEvent, normalizeEventPersistence } from './events.js'

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
  EnqueueAndWaitOptions,
  EnqueueAndWaitResult,
  EnqueueAndWaitSuccess,
  EnqueueCommand,
  EnqueueOptions,
  EnqueueResult,
  EnqueueSuccess,
  WaitOptions,
} from './commands.js'

export {
  EnqueueAndWaitException,
  isEnqueueFailure,
  isEnqueueSuccess,
  isTerminalStatus,
} from './commands.js'

// Config
export type {
  CacheConfig,
  Collection,
  CqrsClientConfig,
  ExecutionMode,
  ExecutionModeConfig,
  FetchContext,
  NetworkConfig,
  ResolvedConfig,
  RetryConfig,
  SeedEventPage,
  SeedRecord,
  SeedRecordPage,
  SqliteVfsType,
  StorageConfig,
} from './config.js'

export { DEFAULT_CONFIG, resolveConfig } from './config.js'

// Re-export ICommandSender from config's dependency for convenience
export type { ICommandSender } from '../core/command-queue/types.js'

// Re-export ddd-es event types for consumer convenience
export type { IPersistedEvent, ISerializedEvent } from '@meticoeus/ddd-es'
