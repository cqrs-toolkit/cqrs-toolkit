/**
 * File-object collection helpers — topic routing.
 *
 * File-object events are tagged with the same `Notebook:{notebookId}` topic as notes,
 * so the cache key derivation and subscription logic is identical.
 */

export { cacheKeysFromTopics, subscribeTopics } from '#notes/domain'

export const FILE_OBJECTS_COLLECTION_NAME = 'file_objects'
