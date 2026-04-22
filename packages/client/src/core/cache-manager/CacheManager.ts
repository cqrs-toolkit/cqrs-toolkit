/**
 * Cache manager handles cache key lifecycle, eviction, and holds.
 *
 * Key concepts:
 * - Cache keys define boundaries of cached data
 * - Holds prevent eviction (e.g., data being displayed)
 * - Freeze prevents any changes to the cache key
 * - LRU eviction based on access time
 * - Per-window hold tracking enables tab-death cleanup
 * - Ephemeral keys are auto-evicted when unheld and cannot be frozen
 * - In-memory registry is authoritative; SQL is durability via dirty flush
 * - registerCacheKey assigns opaque UUIDs and auto-wires EntityRef reconciliation
 */

import { assert, stableStringify } from '#utils'
import { logProvider, type Link } from '@meticoeus/ddd-es'
import type { CacheKeyRecord, IStorage } from '../../storage/IStorage.js'
import type { CacheConfig } from '../../types/config.js'
import { isEntityRef, type EntityRef } from '../../types/entities.js'
import { EnqueueCommand } from '../../types/index.js'
import type { ICommandQueueInternal } from '../command-queue/types.js'
import { resolveRefPaths, setAtPath } from '../entity-ref/ref-path.js'
import type { EventBus } from '../events/EventBus.js'
import type { IWriteQueue } from '../write-queue/IWriteQueue.js'
import {
  hydrateCacheKeyIdentity,
  identityToRecord,
  isEntityCacheKey,
  isScopeCacheKey,
  templateToIdentity,
  type CacheKeyIdentity,
  type CacheKeyTemplate,
  type ScopeCacheKeyTemplate,
} from './CacheKey.js'
import type { AcquireCacheKeyOptions, ICacheManagerInternal } from './types.js'

/**
 * Cache manager configuration.
 */
export interface CacheManagerConfig {
  cacheConfig?: CacheConfig
}

// Re-export types for backwards compatibility
export type { AcquireCacheKeyOptions } from './types.js'

/**
 * Pending ID mapping entry stored in CacheKeyRecord.pendingIdMappings.
 */
export interface PendingIdMapping {
  commandId: string
  clientId: string
  /** JSONPath into scopeParams for scope keys. Absent for entity keys (always link.id). */
  paramKey?: string
}

/**
 * In-memory entry for a registered cache key.
 */
interface CacheKeyRegistration<TLink extends Link> {
  identity: CacheKeyIdentity<TLink>
  pendingIdMappings: PendingIdMapping[]
  evictionPolicy: 'persistent' | 'ephemeral'
  expiresAt: number | null
  lastAccessedAt: number
  createdAt: number
  frozen: boolean
  frozenAt: number | null
  inheritedFrozen: boolean
}

/**
 * Cache manager implementation.
 */
export class CacheManager<
  TLink extends Link,
  TCommand extends EnqueueCommand,
> implements ICacheManagerInternal<TLink> {
  private readonly maxCacheKeys: number
  private readonly defaultTtl: number
  private readonly evictionPolicy: 'lru' | 'fifo'
  private readonly maxWindows: number

  /** Per-key set of windowIds that hold the key */
  private readonly holdsByKey = new Map<string, Set<string>>()

  /** Registered windows (for capacity guard) */
  private readonly registeredWindows = new Set<string>()

  /** Identity string → CacheKeyRegistration. Authoritative in-memory registry. */
  private readonly registry = new Map<string, CacheKeyRegistration<TLink>>()

  /** UUID → identity string. Reverse lookup for finding registry entry by key UUID. */
  private readonly uuidToIdentity = new Map<string, string>()

  /** commandId → Set<cache key UUID>. Reverse index for reconciliation. */
  private readonly pendingByCommand = new Map<string, Set<string>>()

  /** parentKey UUID → Set of child UUIDs. Reverse index for hierarchy traversal. */
  private readonly childrenByParent = new Map<string, Set<string>>()

  /** UUIDs of registry entries modified since last SQL flush. */
  private readonly dirty = new Set<string>()

  /**
   * UUIDs pending deletion from storage on next flush.
   * Used only for deferred deletions (ephemeral auto-eviction in release/releaseAllForWindow).
   * Explicit eviction methods call storage.deleteCacheKey directly for immediate cascade.
   */
  private readonly deletedKeys = new Set<string>()

  /** Whether a flush-cache-keys op is already enqueued. */
  private flushPending = false

  /** CommandQueue reference for synchronous id mapping lookup. Set via setCommandQueue(). */
  private commandQueue: ICommandQueueInternal<TLink, TCommand> | undefined

  /** WriteQueue reference for dirty flush scheduling. Set via setWriteQueue(). */
  private writeQueue: IWriteQueue<TLink, TCommand> | undefined

  constructor(
    private readonly eventBus: EventBus<TLink>,
    private readonly storage: IStorage<TLink, TCommand>,
    config: CacheManagerConfig = {},
  ) {
    this.maxCacheKeys = config.cacheConfig?.maxCacheKeys ?? 1000
    this.defaultTtl = config.cacheConfig?.defaultTtl ?? 30 * 60 * 1000 // 30 minutes
    this.evictionPolicy = config.cacheConfig?.evictionPolicy ?? 'lru'
    this.maxWindows = config.cacheConfig?.maxWindows ?? 10
  }

  /**
   * Set the CommandQueue reference for synchronous id mapping lookup.
   * Called after construction by the orchestrator to break the circular dependency.
   */
  setCommandQueue(commandQueue: ICommandQueueInternal<TLink, TCommand>): void {
    this.commandQueue = commandQueue
  }

  /**
   * Set the WriteQueue reference for dirty flush scheduling.
   * Called after construction by the orchestrator.
   */
  setWriteQueue(writeQueue: IWriteQueue<TLink, TCommand>): void {
    this.writeQueue = writeQueue
    this.writeQueue.register('flush-cache-keys', this.onFlushCacheKeys.bind(this))
    // Reset the pending flag if the op is evicted (session reset / destroy)
    // before the handler runs. Without this, the flag stays true forever and
    // `scheduleDirtyFlush` silently no-ops for the lifetime of the instance.
    this.writeQueue.registerEviction('flush-cache-keys', () => {
      this.flushPending = false
    })
  }

  /**
   * Initialize the cache manager.
   * Loads persisted cache keys into the in-memory registry,
   * resets hold counts, evicts ephemeral keys, and registers this window.
   */
  async initialize(): Promise<void> {
    const allKeys = await this.storage.getAllCacheKeys()

    // Process all records synchronously — build registry, collect batch operations
    const ephemeralKeysToDelete: string[] = []
    const holdResets: CacheKeyRecord[] = []

    for (const record of allKeys) {
      if (record.evictionPolicy === 'ephemeral') {
        ephemeralKeysToDelete.push(record.key)
        this.eventBus.emit('cache:evicted', {
          cacheKey: hydrateCacheKeyIdentity<TLink>(record),
          reason: 'explicit',
        })
        continue
      }

      // Collect hold resets for batch write
      if (record.holdCount !== 0) {
        holdResets.push({ ...record, holdCount: 0 })
      }

      // Build registry entry from persisted record
      const identity = hydrateCacheKeyIdentity<TLink>(record)
      const identityStr = buildIdentityString(identity)
      const pendingIdMappings: PendingIdMapping[] = record.pendingIdMappings
        ? (JSON.parse(record.pendingIdMappings) as PendingIdMapping[])
        : []

      const registration: CacheKeyRegistration<TLink> = {
        identity,
        pendingIdMappings,
        evictionPolicy: record.evictionPolicy,
        expiresAt: record.expiresAt,
        lastAccessedAt: record.lastAccessedAt,
        createdAt: record.createdAt,
        frozen: record.frozen,
        frozenAt: record.frozenAt,
        inheritedFrozen: record.inheritedFrozen,
      }

      this.registry.set(identityStr, registration)
      this.uuidToIdentity.set(record.key, identityStr)

      // Build childrenByParent index
      if (record.parentKey) {
        let children = this.childrenByParent.get(record.parentKey)
        if (!children) {
          children = new Set()
          this.childrenByParent.set(record.parentKey, children)
        }
        children.add(record.key)
      }

      // Rebuild reverse index for pending mappings
      for (const entry of pendingIdMappings) {
        let set = this.pendingByCommand.get(entry.commandId)
        if (!set) {
          set = new Set()
          this.pendingByCommand.set(entry.commandId, set)
        }
        set.add(record.key)
      }
    }

    // Batch storage cleanup
    await this.storage.deleteCacheKeys(ephemeralKeysToDelete)
    await this.storage.saveCacheKeys(holdResets)
  }

  /**
   * Acquire a cache key, returning only the UUID string.
   * Convenience wrapper around {@link acquireKey} for callers that only need the key.
   */
  async acquire(
    cacheKey: CacheKeyIdentity<TLink>,
    options?: AcquireCacheKeyOptions,
  ): Promise<string> {
    const result = await this.acquireKey(cacheKey, options)
    return result.key
  }

  /**
   * Acquire a cache key identity. Creates or updates in the in-memory registry.
   * Returns the full identity object with the UUID key and all source data.
   *
   * For keys created via `registerCacheKey`, the registry already has the entry —
   * this just touches lastAccessedAt and applies hold. For UUID v5 keys (e.g., from
   * `deriveScopeKey`), the registry entry is created here.
   */
  async acquireKey(
    cacheKey: CacheKeyIdentity<TLink>,
    options?: AcquireCacheKeyOptions,
  ): Promise<CacheKeyIdentity<TLink>> {
    const now = Date.now()
    const identityStr = buildIdentityString(cacheKey)
    const existing = this.registry.get(identityStr)

    if (existing) {
      existing.lastAccessedAt = now
      this.dirty.add(existing.identity.key)
      if (options?.hold && options.windowId) {
        this.holdForWindow(existing.identity.key, options.windowId)
      }
      this.eventBus.emit('cache:key-accessed', { cacheKey: existing.identity })
      this.scheduleDirtyFlush()
      return existing.identity
    }

    // New key — add to registry
    await this.maybeEvict()

    const registration: CacheKeyRegistration<TLink> = {
      identity: cacheKey,
      pendingIdMappings: [],
      evictionPolicy: options?.evictionPolicy ?? 'persistent',
      expiresAt:
        (options?.ttl ?? this.defaultTtl) > 0 ? now + (options?.ttl ?? this.defaultTtl) : null,
      lastAccessedAt: now,
      createdAt: now,
      frozen: false,
      frozenAt: null,
      inheritedFrozen: false,
    }
    this.registry.set(identityStr, registration)
    this.uuidToIdentity.set(cacheKey.key, identityStr)
    this.dirty.add(cacheKey.key)

    // Maintain childrenByParent index
    if (cacheKey.parentKey) {
      let children = this.childrenByParent.get(cacheKey.parentKey)
      if (!children) {
        children = new Set()
        this.childrenByParent.set(cacheKey.parentKey, children)
      }
      children.add(cacheKey.key)
    }

    if (options?.hold && options.windowId) {
      this.holdForWindow(cacheKey.key, options.windowId)
    }

    this.eventBus.emit('cache:key-added', {
      cacheKey,
      evictionPolicy: registration.evictionPolicy,
    })
    this.scheduleDirtyFlush()
    return cacheKey
  }

  // ---------------------------------------------------------------------------
  // Cache key registration
  // ---------------------------------------------------------------------------

  /**
   * Register a cache key from a template. Assigns a stable opaque UUID.
   * Auto-wires pending ID reconciliation from EntityRef values in the template.
   *
   * Async wrapper around registerCacheKeySync — schedules a dirty flush after.
   */
  async registerCacheKey(
    template: CacheKeyTemplate<TLink>,
    options?: AcquireCacheKeyOptions,
  ): Promise<CacheKeyIdentity<TLink>> {
    const identity = this.registerCacheKeySync(template, options)
    if (options?.hold && options.windowId) {
      this.holdForWindow(identity.key, options.windowId)
    }
    this.scheduleDirtyFlush()
    return identity
  }

  /**
   * Synchronous registration. Called by internal callers in the same thread.
   * Does not touch storage — the dirty flush handles persistence.
   */
  registerCacheKeySync(
    template: CacheKeyTemplate<TLink>,
    options?: AcquireCacheKeyOptions,
  ): CacheKeyIdentity<TLink> {
    const now = Date.now()

    // Step 1: Scan template for EntityRef values, build pending entries
    const { resolvedTemplate, pendingEntries } = scanTemplateForEntityRefs(template)

    // Step 2: Build identity string from resolved (string) identity fields
    const identityStr = buildIdentityStringFromTemplate(resolvedTemplate)

    // Step 3: Structural lookup in registry
    const existing = this.registry.get(identityStr)
    if (existing) {
      existing.lastAccessedAt = now
      this.dirty.add(existing.identity.key)
      if (options?.hold && options.windowId) {
        this.holdForWindow(existing.identity.key, options.windowId)
      }
      this.eventBus.emit('cache:key-accessed', { cacheKey: existing.identity })
      return existing.identity
    }

    // Step 4: Create new entry with opaque UUID
    const key = crypto.randomUUID()
    const identity = templateToIdentity(resolvedTemplate, key)

    // Step 5: Check for already-settled commands
    const unresolvedEntries: PendingIdMapping[] = []
    for (const entry of pendingEntries) {
      const mapping = this.commandQueue?.getIdMapping(entry.clientId)
      if (mapping) {
        // Already settled — apply resolution immediately
        this.applyIdResolution(identity, entry, mapping.serverId)
      } else {
        unresolvedEntries.push(entry)
      }
    }

    // Step 6: Build registry entry
    const registration: CacheKeyRegistration<TLink> = {
      identity,
      pendingIdMappings: unresolvedEntries,
      evictionPolicy: options?.evictionPolicy ?? 'persistent',
      expiresAt:
        (options?.ttl ?? this.defaultTtl) > 0 ? now + (options?.ttl ?? this.defaultTtl) : null,
      lastAccessedAt: now,
      createdAt: now,
      frozen: false,
      frozenAt: null,
      inheritedFrozen: false,
    }
    this.registry.set(identityStr, registration)
    this.uuidToIdentity.set(key, identityStr)

    // Step 7: Maintain childrenByParent index
    if (identity.parentKey) {
      let children = this.childrenByParent.get(identity.parentKey)
      if (!children) {
        children = new Set()
        this.childrenByParent.set(identity.parentKey, children)
      }
      children.add(key)
    }

    // Step 8: Update reverse index for unsettled commands
    for (const entry of unresolvedEntries) {
      let set = this.pendingByCommand.get(entry.commandId)
      if (!set) {
        set = new Set()
        this.pendingByCommand.set(entry.commandId, set)
      }
      set.add(key)
    }

    // Step 9: Mark dirty, hold, emit
    this.dirty.add(key)

    if (options?.hold && options.windowId) {
      this.holdForWindow(key, options.windowId)
    }

    this.eventBus.emit('cache:key-added', {
      cacheKey: identity,
      evictionPolicy: registration.evictionPolicy,
    })

    return identity
  }

  /**
   * Resolve pending cache keys when a command succeeds with ID mappings.
   * Called by CommandQueue after reconcileCreateIds.
   *
   * @param commandId - The succeeded command's ID
   * @param idMap - clientId → serverId mappings
   * @param resolveCacheKey - Optional custom resolver from command handler registration
   */
  resolvePendingKeys(
    commandId: string,
    idMap: Record<string, { serverId: string }>,
    resolveCacheKey?: (cacheKey: CacheKeyIdentity<TLink>) => CacheKeyIdentity<TLink>,
  ): void {
    const keyUuids = this.pendingByCommand.get(commandId)
    if (!keyUuids || keyUuids.size === 0) return

    for (const uuid of keyUuids) {
      const identityStr = this.uuidToIdentity.get(uuid)
      if (!identityStr) continue

      const registration = this.registry.get(identityStr)
      if (!registration) continue

      const pendingEntry = registration.pendingIdMappings.find((e) => e.commandId === commandId)
      if (!pendingEntry) continue

      const mapping = idMap[pendingEntry.clientId]
      if (!mapping) continue

      // Capture previous identity for event
      const previousIdentity = { ...registration.identity }

      if (resolveCacheKey) {
        const updated = resolveCacheKey(registration.identity)
        if (isEntityCacheKey<TLink>(updated) && isEntityCacheKey<TLink>(registration.identity)) {
          registration.identity.link = updated.link
        } else if (
          isScopeCacheKey<TLink>(updated) &&
          isScopeCacheKey<TLink>(registration.identity)
        ) {
          registration.identity.scopeParams = updated.scopeParams
        }
      } else {
        // Default resolution
        this.applyIdResolution(registration.identity, pendingEntry, mapping.serverId)
      }

      // Remove resolved entry
      registration.pendingIdMappings = registration.pendingIdMappings.filter(
        (e) => e.commandId !== commandId,
      )

      // Update registry index — identity string changed
      this.registry.delete(identityStr)
      const newIdentityStr = buildIdentityString(registration.identity)
      this.registry.set(newIdentityStr, registration)
      this.uuidToIdentity.set(uuid, newIdentityStr)

      this.dirty.add(uuid)

      this.eventBus.emit('cache:key-reconciled', {
        cacheKey: registration.identity,
        previousIdentity: previousIdentity as CacheKeyIdentity<TLink>,
        commandId,
        clientId: pendingEntry.clientId,
        serverId: mapping.serverId,
      })

      logProvider.log.debug(
        {
          commandId,
          cacheKey: uuid,
          clientId: pendingEntry.clientId,
          serverId: mapping.serverId,
        },
        'Cache key reconciled',
      )
    }

    this.pendingByCommand.delete(commandId)
    this.scheduleDirtyFlush()
  }

  // ---------------------------------------------------------------------------
  // Registry-first query methods
  // ---------------------------------------------------------------------------

  async exists(key: string): Promise<boolean> {
    return this.uuidToIdentity.has(key)
  }

  existsSync(key: string): boolean {
    return this.uuidToIdentity.has(key)
  }

  async get(key: string): Promise<CacheKeyRecord | undefined> {
    return this.getRegistrationRecord(key)
  }

  async touch(cacheKey: CacheKeyIdentity<TLink>): Promise<void> {
    await this.acquireKey(cacheKey, { hold: false })
  }

  async hold(_key: string): Promise<void> {
    assert.fail('CacheManager.hold() requires a windowId. Use holdForWindow() or the facade.')
  }

  async release(_key: string): Promise<void> {
    assert.fail('CacheManager.release() requires a windowId. Use releaseForWindow() or the facade.')
  }

  /**
   * Place a hold on a cache key for a specific window.
   * While held by any window, the cache key cannot be evicted.
   * Idempotent: calling hold twice for the same window is a no-op.
   */
  holdForWindow(key: string, windowId: string): void {
    let windowSet = this.holdsByKey.get(key)
    if (!windowSet) {
      windowSet = new Set()
      this.holdsByKey.set(key, windowSet)
    }

    if (windowSet.has(windowId)) {
      return
    }

    windowSet.add(windowId)
    this.dirty.add(key)
    this.scheduleDirtyFlush()
  }

  /**
   * Release a hold on a cache key for a specific window.
   * If this was the last window holding the key, the persisted holdCount drops to 0.
   * Ephemeral keys are auto-evicted when the last hold is released.
   */
  releaseForWindow(key: string, windowId: string): void {
    const windowSet = this.holdsByKey.get(key)
    if (!windowSet || !windowSet.has(windowId)) {
      return
    }

    windowSet.delete(windowId)

    if (windowSet.size === 0) {
      this.holdsByKey.delete(key)

      const registration = this.getRegistration(key)
      if (registration?.evictionPolicy === 'ephemeral') {
        this.removeFromRegistry(registration.identity.key)
        this.deletedKeys.add(registration.identity.key)
        this.eventBus.emit('cache:evicted', {
          cacheKey: registration.identity,
          reason: 'explicit',
        })
        this.scheduleDirtyFlush()
        return
      }
    }

    this.dirty.add(key)
    this.scheduleDirtyFlush()
  }

  /**
   * Release all holds on the given cache keys across all windows.
   * Used by QueryManager.destroy() to clean up without knowing window IDs.
   */
  releaseHolds(keys: string[]): void {
    for (const key of keys) {
      const windowSet = this.holdsByKey.get(key)
      if (!windowSet || windowSet.size === 0) continue

      this.holdsByKey.delete(key)

      const registration = this.getRegistration(key)
      if (registration?.evictionPolicy === 'ephemeral') {
        this.removeFromRegistry(key)
        this.deletedKeys.add(key)
        this.eventBus.emit('cache:evicted', {
          cacheKey: registration.identity,
          reason: 'explicit',
        })
      }

      this.dirty.add(key)
    }
    this.scheduleDirtyFlush()
  }

  /**
   * Release all holds for a specific window across all cache keys.
   * Used for tab-death cleanup.
   */
  async releaseAllForWindow(windowId: string): Promise<void> {
    // Collect keys to process — avoid mutating holdsByKey during iteration
    const keysToProcess: string[] = []
    for (const [key, windowSet] of this.holdsByKey) {
      if (windowSet.has(windowId)) {
        keysToProcess.push(key)
      }
    }

    for (const key of keysToProcess) {
      const windowSet = this.holdsByKey.get(key)
      if (!windowSet) continue

      windowSet.delete(windowId)

      if (windowSet.size === 0) {
        this.holdsByKey.delete(key)

        const registration = this.getRegistration(key)
        if (registration?.evictionPolicy === 'ephemeral') {
          this.removeFromRegistry(registration.identity.key)
          this.deletedKeys.add(registration.identity.key)
          this.eventBus.emit('cache:evicted', {
            cacheKey: registration.identity,
            reason: 'explicit',
          })
          continue
        }
      }

      this.dirty.add(key)
    }

    this.scheduleDirtyFlush()
  }

  /**
   * Register a window for capacity tracking.
   * Returns false and emits event if at capacity.
   */
  registerWindow(windowId: string): boolean {
    if (this.registeredWindows.has(windowId)) {
      return true
    }

    if (this.registeredWindows.size >= this.maxWindows) {
      this.eventBus.emit('cache:too-many-windows', {
        windowId,
        maxWindows: this.maxWindows,
      })
      return false
    }

    this.registeredWindows.add(windowId)
    return true
  }

  /**
   * Unregister a window, releasing all its holds.
   */
  async unregisterWindow(windowId: string): Promise<void> {
    this.registeredWindows.delete(windowId)
    await this.releaseAllForWindow(windowId)
  }

  async freeze(key: string): Promise<void> {
    const registration = this.getRegistration(key)
    if (registration && registration.evictionPolicy !== 'ephemeral' && !registration.frozen) {
      const frozenAt = Date.now()
      registration.frozen = true
      registration.frozenAt = frozenAt
      this.dirty.add(key)
      this.propagateInheritedFrozen(key, true)
      this.eventBus.emit('cache:frozen-changed', {
        cacheKey: registration.identity,
        frozen: true,
        frozenAt,
      })
      this.scheduleDirtyFlush()
    }
  }

  async unfreeze(key: string): Promise<void> {
    const registration = this.getRegistration(key)
    if (registration && registration.frozen) {
      registration.frozen = false
      registration.frozenAt = null
      this.dirty.add(key)
      this.reevaluateInheritedFrozen(key)
      this.eventBus.emit('cache:frozen-changed', {
        cacheKey: registration.identity,
        frozen: false,
        frozenAt: null,
      })
      this.scheduleDirtyFlush()
    }
  }

  async isFrozen(key: string): Promise<boolean> {
    const registration = this.getRegistration(key)
    if (!registration) return false
    return registration.frozen
  }

  async evict(key: string): Promise<boolean> {
    const registration = this.getRegistration(key)
    if (!registration) {
      return false
    }

    const windowSet = this.holdsByKey.get(key)
    if (windowSet && windowSet.size > 0) {
      return false
    }

    if (registration.frozen || registration.inheritedFrozen) {
      return false
    }

    // Cannot evict a parent while children exist
    const children = this.childrenByParent.get(key)
    if (children && children.size > 0) {
      return false
    }

    this.removeFromRegistry(key)
    await this.storage.deleteCacheKey(key)
    this.eventBus.emit('cache:evicted', {
      cacheKey: registration.identity,
      reason: 'explicit',
    })
    return true
  }

  async evictAll(): Promise<number> {
    let count = 0

    // Bottom-up: repeatedly find and evict leaf keys until no more are evictable.
    let evictedThisPass = true
    while (evictedThisPass) {
      evictedThisPass = false
      for (const [, registration] of this.registry) {
        const uuid = registration.identity.key

        // Must be a leaf (no children)
        const children = this.childrenByParent.get(uuid)
        if (children && children.size > 0) continue

        // Must not be held
        const windowSet = this.holdsByKey.get(uuid)
        if (windowSet && windowSet.size > 0) continue

        // Must not be frozen
        if (registration.frozen || registration.inheritedFrozen) continue

        this.removeFromRegistry(uuid)
        await this.storage.deleteCacheKey(uuid)
        this.eventBus.emit('cache:evicted', {
          cacheKey: registration.identity,
          reason: 'explicit',
        })
        count++
        evictedThisPass = true
        // Registry was mutated — restart iteration
        break
      }
    }

    return count
  }

  async evictExpired(): Promise<number> {
    const now = Date.now()
    let count = 0

    // Collect UUIDs to evict first to avoid mutating during iteration
    const toEvict: Array<{ uuid: string; identity: CacheKeyIdentity<TLink> }> = []

    for (const [, registration] of this.registry) {
      const uuid = registration.identity.key
      if (
        registration.expiresAt !== null &&
        registration.expiresAt <= now &&
        !registration.frozen &&
        !registration.inheritedFrozen
      ) {
        const windowSet = this.holdsByKey.get(uuid)
        if (!windowSet || windowSet.size === 0) {
          toEvict.push({ uuid, identity: registration.identity })
        }
      }
    }

    for (const { uuid, identity } of toEvict) {
      this.removeFromRegistry(uuid)
      await this.storage.deleteCacheKey(uuid)
      this.eventBus.emit('cache:evicted', {
        cacheKey: identity,
        reason: 'expired',
      })
      count++
    }

    return count
  }

  async getCount(): Promise<number> {
    return this.registry.size
  }

  async checkSessionUser(userId: string): Promise<boolean> {
    const session = await this.storage.getSession()
    if (!session || session.userId === userId) {
      return false
    }

    // Collect keys, clear in-memory state first, then batch delete from storage
    const keysToDelete = [...this.uuidToIdentity.keys()]

    this.holdsByKey.clear()
    this.registry.clear()
    this.uuidToIdentity.clear()
    this.childrenByParent.clear()
    this.pendingByCommand.clear()
    this.dirty.clear()
    this.deletedKeys.clear()

    this.eventBus.emit('cache:session-reset', {
      previousUserId: session.userId,
      newUserId: userId,
    })

    await this.storage.deleteCacheKeys(keysToDelete)
    return true
  }

  /**
   * Handle session destroyed — clears all cache state.
   */
  async onSessionDestroyed(): Promise<void> {
    // Emit eviction events and collect keys for batch delete
    const keysToDelete: string[] = []
    for (const [, registration] of this.registry) {
      keysToDelete.push(registration.identity.key)
      this.eventBus.emit('cache:evicted', {
        cacheKey: registration.identity,
        reason: 'session-change',
      })
    }

    // Clear all in-memory state first
    this.holdsByKey.clear()
    this.registry.clear()
    this.uuidToIdentity.clear()
    this.childrenByParent.clear()
    this.pendingByCommand.clear()
    this.dirty.clear()
    this.deletedKeys.clear()
    this.flushPending = false

    // Batch delete from storage
    await this.storage.deleteCacheKeys(keysToDelete)
  }

  async filterExistingCacheKeys(keys: string[]): Promise<string[]> {
    return keys.filter((k) => this.uuidToIdentity.has(k))
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Get a registration by UUID.
   */
  private getRegistration(key: string): CacheKeyRegistration<TLink> | undefined {
    const identityStr = this.uuidToIdentity.get(key)
    if (!identityStr) return undefined
    return this.registry.get(identityStr)
  }

  /**
   * Build a CacheKeyRecord from a registration for the public `get()` method and flush handler.
   */
  private registrationToRecord(registration: CacheKeyRegistration<TLink>): CacheKeyRecord {
    const uuid = registration.identity.key
    const record = identityToRecord(registration.identity, {
      evictionPolicy: registration.evictionPolicy,
      expiresAt: registration.expiresAt,
      now: registration.lastAccessedAt,
      pendingIdMappings:
        registration.pendingIdMappings.length > 0
          ? JSON.stringify(registration.pendingIdMappings)
          : null,
    })

    // Preserve createdAt from registration (not overwrite with lastAccessedAt)
    record.createdAt = registration.createdAt

    // Frozen state from registration
    record.frozen = registration.frozen
    record.frozenAt = registration.frozenAt
    record.inheritedFrozen = registration.inheritedFrozen

    // Persist hold count from in-memory tracking
    const windowSet = this.holdsByKey.get(uuid)
    record.holdCount = windowSet ? windowSet.size : 0

    return record
  }

  /**
   * Get a CacheKeyRecord built from the in-memory registration.
   * Returns undefined if the key is not in the registry.
   */
  private getRegistrationRecord(key: string): CacheKeyRecord | undefined {
    const registration = this.getRegistration(key)
    if (!registration) return undefined
    return this.registrationToRecord(registration)
  }

  /**
   * Remove a key from all in-memory structures.
   * Does NOT touch storage — callers decide whether to delete from storage
   * immediately (explicit eviction) or defer to flush (ephemeral auto-eviction).
   */
  private removeFromRegistry(uuid: string): void {
    const identityStr = this.uuidToIdentity.get(uuid)
    if (!identityStr) return

    const registration = this.registry.get(identityStr)

    this.registry.delete(identityStr)
    this.uuidToIdentity.delete(uuid)
    this.holdsByKey.delete(uuid)
    this.dirty.delete(uuid)

    // Remove from parent's children set
    if (registration?.identity.parentKey) {
      const siblings = this.childrenByParent.get(registration.identity.parentKey)
      if (siblings) {
        siblings.delete(uuid)
        if (siblings.size === 0) {
          this.childrenByParent.delete(registration.identity.parentKey)
        }
      }
    }

    // Remove as parent (children should already be evicted in bottom-up eviction,
    // but clean up the index entry regardless)
    this.childrenByParent.delete(uuid)
  }

  /**
   * Propagate inheritedFrozen = true to all descendants of a key.
   * Called when a key is frozen — all children (recursively) inherit the frozen state.
   */
  private propagateInheritedFrozen(key: string, frozen: boolean): void {
    const children = this.childrenByParent.get(key)
    if (!children) return

    for (const childUuid of children) {
      const childReg = this.getRegistration(childUuid)
      if (!childReg) continue

      // §2.6: Ephemeral keys never contribute to or receive inherited freeze state
      if (childReg.evictionPolicy === 'ephemeral') continue

      if (childReg.inheritedFrozen !== frozen) {
        childReg.inheritedFrozen = frozen
        this.dirty.add(childUuid)
      }
      this.propagateInheritedFrozen(childUuid, frozen)
    }
  }

  /**
   * Re-evaluate inheritedFrozen for all descendants of a key.
   * Called when a key is unfrozen — children may still inherit freeze from other ancestors.
   */
  private reevaluateInheritedFrozen(key: string): void {
    const children = this.childrenByParent.get(key)
    if (!children) return

    for (const childUuid of children) {
      const childReg = this.getRegistration(childUuid)
      if (!childReg) continue

      // §2.6: Ephemeral keys never contribute to or receive inherited freeze state
      if (childReg.evictionPolicy === 'ephemeral') continue

      const shouldBeInherited = this.isAncestorFrozen(childUuid)
      if (childReg.inheritedFrozen !== shouldBeInherited) {
        childReg.inheritedFrozen = shouldBeInherited
        this.dirty.add(childUuid)
      }
      this.reevaluateInheritedFrozen(childUuid)
    }
  }

  /**
   * Check if any ancestor in the parent chain is frozen.
   * Fully in-memory — walks the registry via parentKey.
   */
  private isAncestorFrozen(key: string): boolean {
    const registration = this.getRegistration(key)
    if (!registration?.identity.parentKey) return false

    const parentReg = this.getRegistration(registration.identity.parentKey)
    if (!parentReg) return false
    if (parentReg.frozen) return true

    return this.isAncestorFrozen(parentReg.identity.key)
  }

  private async maybeEvict(): Promise<void> {
    if (this.registry.size < this.maxCacheKeys) {
      return
    }

    // Find the oldest lastAccessedAt among evictable entries.
    // Prefer ephemeral keys over persistent when evicting.
    let oldestEphemeral: { uuid: string; registration: CacheKeyRegistration<TLink> } | undefined
    let oldestPersistent: { uuid: string; registration: CacheKeyRegistration<TLink> } | undefined

    for (const [, registration] of this.registry) {
      const uuid = registration.identity.key

      // Must be a leaf (no children)
      const children = this.childrenByParent.get(uuid)
      if (children && children.size > 0) continue

      // Must not be held
      const windowSet = this.holdsByKey.get(uuid)
      if (windowSet && windowSet.size > 0) continue

      // Must not be frozen
      if (registration.frozen || registration.inheritedFrozen) continue

      if (registration.evictionPolicy === 'ephemeral') {
        if (
          !oldestEphemeral ||
          registration.lastAccessedAt < oldestEphemeral.registration.lastAccessedAt
        ) {
          oldestEphemeral = { uuid, registration }
        }
      } else {
        if (
          !oldestPersistent ||
          registration.lastAccessedAt < oldestPersistent.registration.lastAccessedAt
        ) {
          oldestPersistent = { uuid, registration }
        }
      }
    }

    // Prefer evicting ephemeral keys first
    const victim = oldestEphemeral ?? oldestPersistent
    if (victim) {
      this.removeFromRegistry(victim.uuid)
      await this.storage.deleteCacheKey(victim.uuid)
      this.eventBus.emit('cache:evicted', {
        cacheKey: victim.registration.identity,
        reason: 'lru',
      })
    }
  }

  /**
   * Apply a single ID resolution to an identity's fields.
   */
  private applyIdResolution(
    identity: CacheKeyIdentity<TLink>,
    entry: PendingIdMapping,
    serverId: string,
  ): void {
    if (isEntityCacheKey<TLink>(identity)) {
      identity.link = { ...identity.link, id: serverId }
    } else if (isScopeCacheKey(identity) && entry.paramKey && identity.scopeParams) {
      identity.scopeParams = setAtPath(identity.scopeParams, entry.paramKey, serverId)
    }
  }

  /**
   * Schedule a dirty flush through the write queue.
   * No-op if a flush is already pending.
   */
  private scheduleDirtyFlush(): void {
    if (this.flushPending || (this.dirty.size === 0 && this.deletedKeys.size === 0)) return
    if (!this.writeQueue) return

    this.flushPending = true
    // Fire and forget — the eviction handler registered in setWriteQueue
    // resets `flushPending` if the op is discarded before it runs, and the
    // handler itself clears it as its first action. `.catch()` is the wrong
    // mechanism: it doesn't cover every discard path and the WriteQueue
    // already owns the discard → eviction-handler contract.
    void this.writeQueue.enqueue({ type: 'flush-cache-keys' })
  }

  /**
   * Write queue handler for flush-cache-keys operations.
   * Processes deletions first, then persists dirty entries.
   */
  private async onFlushCacheKeys(): Promise<void> {
    this.flushPending = false

    // Batch deletions
    const toDelete = [...this.deletedKeys]
    this.deletedKeys.clear()
    await this.storage.deleteCacheKeys(toDelete)

    // Batch dirty entry persistence
    const records: CacheKeyRecord[] = []
    for (const uuid of this.dirty) {
      const identityStr = this.uuidToIdentity.get(uuid)
      if (!identityStr) continue
      const registration = this.registry.get(identityStr)
      if (!registration) continue
      records.push(this.registrationToRecord(registration))
    }
    this.dirty.clear()
    await this.storage.saveCacheKeys(records)
  }
}

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

/**
 * Build a stable identity string for dedup in the registry.
 * Same inputs always produce the same string.
 */
function buildIdentityString<TLink extends Link>(identity: CacheKeyIdentity<TLink>): string {
  if (identity.kind === 'entity') {
    const parts: string[] = ['entity']
    if ('service' in identity.link && typeof identity.link.service === 'string') {
      parts.push(identity.link.service)
    }
    parts.push(identity.link.type, identity.link.id)
    return parts.join(':')
  }

  const parts: string[] = ['scope']
  if (identity.service) {
    parts.push(identity.service)
  }
  parts.push(identity.scopeType)
  if (identity.scopeParams && Object.keys(identity.scopeParams).length > 0) {
    parts.push(stableStringify(identity.scopeParams))
  }
  return parts.join(':')
}

/**
 * Build a stable identity string from a resolved template (EntityRef replaced with strings).
 */
function buildIdentityStringFromTemplate<TLink extends Link>(
  template: CacheKeyTemplate<TLink>,
): string {
  if (template.kind === 'entity') {
    const parts: string[] = ['entity']
    if ('service' in template.link && typeof template.link.service === 'string') {
      parts.push(template.link.service)
    }
    parts.push(template.link.type, template.link.id)
    return parts.join(':')
  }

  const parts: string[] = ['scope']
  if (template.service) {
    parts.push(template.service)
  }
  parts.push(template.scopeType)
  if (template.scopeParams && Object.keys(template.scopeParams).length > 0) {
    parts.push(stableStringify(template.scopeParams))
  }
  return parts.join(':')
}

/**
 * Scan a template for EntityRef values and build pending entries.
 * Returns a resolved copy of the template (EntityRef replaced with plain strings)
 * and the pending entries array.
 */
function scanTemplateForEntityRefs<TLink extends Link>(
  template: CacheKeyTemplate<TLink>,
): {
  resolvedTemplate: CacheKeyTemplate<TLink>
  pendingEntries: PendingIdMapping[]
} {
  const pendingEntries: PendingIdMapping[] = []

  if (template.kind === 'entity') {
    if (isEntityRef(template.link.id)) {
      const ref: EntityRef = template.link.id
      pendingEntries.push({ commandId: ref.commandId, clientId: ref.entityId })
      const resolvedLink = { ...template.link, id: ref.entityId } as TLink
      return {
        resolvedTemplate: { ...template, link: resolvedLink },
        pendingEntries,
      }
    }
    return { resolvedTemplate: template, pendingEntries }
  }

  // Scope key: scan top-level scopeParams + entityRefPaths
  if (!template.scopeParams) {
    return { resolvedTemplate: template, pendingEntries }
  }

  let resolvedParams = { ...template.scopeParams }
  let hasChanges = false

  // Default: scan top-level values
  for (const [key, value] of Object.entries(resolvedParams)) {
    if (isEntityRef(value)) {
      pendingEntries.push({
        commandId: value.commandId,
        clientId: value.entityId,
        paramKey: `$.${key}`,
      })
      resolvedParams[key] = value.entityId
      hasChanges = true
    }
  }

  // Declared paths: resolve entityRefPaths for nested structures
  if ((template as ScopeCacheKeyTemplate).entityRefPaths) {
    const deepRefs = resolveRefPaths(
      resolvedParams,
      (template as ScopeCacheKeyTemplate).entityRefPaths!,
    )
    for (const [path, ref] of Object.entries(deepRefs)) {
      if (isEntityRef(ref)) {
        pendingEntries.push({
          commandId: ref.commandId,
          clientId: ref.entityId,
          paramKey: path,
        })
        resolvedParams = setAtPath(resolvedParams, path, ref.entityId)
        hasChanges = true
      }
    }
  }

  if (hasChanges) {
    return {
      resolvedTemplate: { ...template, scopeParams: resolvedParams },
      pendingEntries,
    }
  }

  return { resolvedTemplate: template, pendingEntries }
}
