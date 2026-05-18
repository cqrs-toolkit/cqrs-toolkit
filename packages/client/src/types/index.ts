/**
 * Type exports for the CQRS Client library.
 */

// Aggregates

export {
  ClientAggregate,
  StreamIdParseException,
  isEntityIdLink,
  matchesAggregate,
} from './aggregates.js'
export type {
  AggregateConfig,
  DirectIdReference,
  IdReference,
  LinkIdReference,
} from './aggregates.js'

// Config

export type { ClientAggregatesConfig } from './config.js'

// Entities
export type { EntityId, EntityRef } from './entities.js'

export {
  createEntityRef,
  entityIdEquals,
  entityIdMatches,
  entityIdToString,
  isEntityId,
  isEntityRef,
} from './entities.js'

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
  ClassifierInput,
  CommandHandlerRegistration,
  CreateCommandConfig,
  DomainExecutionOutcome,
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
  domainConflict,
  domainSuccess,
  domainUnknownCommand,
  domainValidationError,
  isAutoRevision,
  isDomainSuccess,
  isUnknownCommand,
} from './domain.js'

// Commands
export type {
  CommandCompletionError,
  CommandDependency,
  CommandErrorSource,
  CommandEvent,
  CommandEventType,
  CommandFailedDetails,
  CommandFilter,
  CommandRecord,
  CommandStatus,
  DependencySource,
  EnqueueAndWaitError,
  EnqueueAndWaitOptions,
  EnqueueAndWaitResult,
  EnqueueAndWaitSuccess,
  EnqueueCommand,
  EnqueueOptions,
  EnqueueRejection,
  EnqueueResult,
  EnqueueSuccess,
  FailureCategory,
  FailureDescriptor,
  FailureMapper,
  HandlerCommand,
  HandlerState,
  ServerErrorResponse,
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
  ConflictException,
  InvalidCommandStatusException,
  isCommandCancelled,
  isCommandFailed,
  isCommandNotFound,
  isCommandTimeout,
  isConflict,
  isEnqueueFailure,
  isEnqueueSuccess,
  isInvalidCommandStatus,
  isPermanent,
  isPermissionDenied,
  isRedundant,
  isTerminalStatus,
  isTransient,
  isUnauthenticated,
  requiresReview,
} from './commands.js'

// Auth
export type { AuthStrategy } from '../core/auth.js'

// Config
export type {
  CacheConfig,
  ClientMode,
  ClientModeConfig,
  Collection,
  CollectionWithSeedOnDemand,
  CollectionWithSeedOnInit,
  CqrsClientConfig,
  CqrsConfig,
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

export type { JSONPathExpression } from './json-path.js'

// Re-export ddd-es event types for consumer convenience
export type { IPersistedEvent, ISerializedEvent } from '@meticoeus/ddd-es'
