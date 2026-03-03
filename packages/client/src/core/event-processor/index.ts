/**
 * Event processor exports.
 */

export type {
  EventProcessor,
  ProcessorContext,
  ProcessorRegistration,
  ProcessorResult,
  UpdateOperation,
} from './types.js'

export { EventProcessorRegistry } from './EventProcessorRegistry.js'
export { EventProcessorRunner } from './EventProcessorRunner.js'
export type { EventProcessorRunnerConfig, ParsedEvent } from './EventProcessorRunner.js'
