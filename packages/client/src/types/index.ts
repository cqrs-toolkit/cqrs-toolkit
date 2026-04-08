/**
 * Type exports for the CQRS Client library.
 */

// Entities
export type { EntityId, EntityRef } from './entities.js'

export { createEntityRef, entityIdToString, isEntityRef } from './entities.js'

// Events
export type {
  AnticipatedEvent,
  AnticipatedEventMeta,
  EventPersistence,
  LibraryEvent,
  LibraryEventData,
  LibraryEventType,
} from './events.js'

export { hydrateSerializedEvent, normalizeEventPersistence } from './events.js'

// Validation
export type { ValidationError, ValidationResult } from './validation.js'

export { ValidationException } from './validation.js'

// Domain
export type {
  AsyncValidationContext,
  AutoRevision,
  CommandHandlerRegistration,
  CreateCommandConfig,
  DomainExecutionError,
  DomainExecutionResult,
  DomainExecutionSuccess,
  ExecutorCommand,
  HandlerContext,
  ICommandHandlerMetadata,
  IDomainExecutor,
  InitializingContext,
  PostProcessPlan,
  SchemaValidator,
  UpdatingContext,
} from './domain.js'

export {
  UnknownCommandException,
  autoRevision,
  createEntityId,
  domainFailure,
  domainSuccess,
  isAutoRevision,
  isDomainFailure,
  isDomainSuccess,
  isUnknownCommand,
} from './domain.js'

// Commands
export type {
  CommandCompletionError,
  CommandErrorSource,
  CommandEvent,
  CommandEventType,
  CommandFailedDetails,
  CommandFilter,
  CommandRecord,
  CommandStatus,
  EnqueueAndWaitError,
  EnqueueAndWaitOptions,
  EnqueueAndWaitResult,
  EnqueueAndWaitSuccess,
  EnqueueCommand,
  EnqueueOptions,
  EnqueueResult,
  EnqueueSuccess,
  SubmitError,
  SubmitOptions,
  SubmitParams,
  SubmitResult,
  SubmitSuccess,
  WaitOptions,
} from './commands.js'

export {
  CommandCancelledException,
  CommandFailedException,
  CommandNotFoundException,
  CommandTimeoutException,
  InvalidCommandStatusException,
  isCommandCancelled,
  isCommandFailed,
  isCommandNotFound,
  isCommandTimeout,
  isEnqueueFailure,
  isEnqueueSuccess,
  isInvalidCommandStatus,
  isTerminalStatus,
} from './commands.js'

// Auth
export type { AuthStrategy } from '../core/auth.js'

// Config
export type {
  CacheConfig,
  Collection,
  CollectionWithSeedOnDemand,
  CollectionWithSeedOnInit,
  CqrsClientConfig,
  CqrsConfig,
  ExecutionMode,
  ExecutionModeConfig,
  FetchContext,
  FetchSeedEventOptions,
  FetchSeedRecordOptions,
  FetchStreamEventOptions,
  LibraryStep,
  ManagedCollectionDef,
  MigrationStep,
  NetworkConfig,
  ResolvedConfig,
  RetryConfig,
  SchemaMigration,
  SeedEventPage,
  SeedOnDemandConfig,
  SeedOnInitConfig,
  SeedRecord,
  SeedRecordPage,
  SqliteVfsType,
  StorageConfig,
} from './config.js'

export { DEFAULT_CONFIG, resolveConfig } from './config.js'

// Re-export ICommandSender from config's dependency for convenience
export type { ICommandSender } from '../core/command-queue/types.js'

// Debug
export type { CqrsDebugAPI, CqrsDevToolsHook } from './debug.js'

// Re-export ddd-es event types for consumer convenience
export type { IPersistedEvent, ISerializedEvent } from '@meticoeus/ddd-es'
