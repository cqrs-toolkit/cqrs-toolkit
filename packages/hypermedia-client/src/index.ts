/**
 * Runtime exports for @cqrs-toolkit/hypermedia-client.
 */

export { createCollection } from './runtime/createCollection.js'
export type { CreateCollectionOptions } from './runtime/createCollection.js'
export { createHypermediaCommandSender } from './runtime/createHypermediaCommandSender.js'
export { createAjvSchemaValidator, withSchemaRegistry } from './runtime/createSchemaValidators.js'
export type { SchemaMap, SchemaRegistry } from './runtime/createSchemaValidators.js'
export { fetchEventPage, fetchStreamEvents } from './runtime/fetchHelpers.js'
export type {
  AfterSendHandler,
  CommandManifest,
  CommandRouting,
  HypermediaCommandSenderOptions,
  RepresentationManifest,
  RepresentationSurfaces,
  SurfaceEndpoint,
  TemplateMapping,
} from './runtime/types.js'
