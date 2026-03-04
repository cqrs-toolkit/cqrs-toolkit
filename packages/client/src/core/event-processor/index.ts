/**
 * Event processor exports.
 */

export type {
  EventProcessor,
  InvalidateSignal,
  ProcessorContext,
  ProcessorRegistration,
  ProcessorResult,
  ProcessorReturn,
  UpdateOperation,
} from './types.js'

export { EventProcessorRegistry } from './EventProcessorRegistry.js'
export { EventProcessorRunner } from './EventProcessorRunner.js'
export type {
  EventProcessorRunnerConfig,
  ParsedEvent,
  ProcessEventResult,
} from './EventProcessorRunner.js'
