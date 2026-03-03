/**
 * Protocol exports for worker communication.
 */

export { WorkerMessageChannel, WorkerMessageHandler } from './MessageChannel.js'
export type { MessageChannelConfig, MessageTarget } from './MessageChannel.js'
export * from './messages.js'
export { deserialize, prepareForTransfer, restoreFromTransfer, serialize } from './serialization.js'
