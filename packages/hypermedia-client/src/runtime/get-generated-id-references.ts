/**
 * Resolve a generated representation's id-bearing fields into runtime
 * `IdReference[]` so collections can wire entity-ref tracking from the
 * codegen output.
 *
 * The codegen stamps `generatedIdReferences` onto each rep manifest entry
 * during `pull` (sourced from the consumer's `idReferences` config). At
 * runtime, the consumer pairs an {@link AggregateRegistry} (mapping
 * aggregate URNs to live {@link AggregateConfig} objects) with the
 * generated manifest, and {@link getGeneratedIdReferences} materialises
 * the {@link IdReference} array `createCollection.idReferences` expects.
 */

import type { AggregateConfig, IdReference } from '@cqrs-toolkit/client'
import type { Link } from '@meticoeus/ddd-es'
import type { GeneratedIdReference, RepresentationSurfaces } from './types.js'

/**
 * Maps aggregate URNs (`urn:aggregate:{service.}{Type}`) to their runtime
 * AggregateConfig. Consumers maintain this and pass it to
 * {@link getGeneratedIdReferences}.
 */
export type AggregateRegistry<TLink extends Link = Link> = Record<string, AggregateConfig<TLink>>

/**
 * Look up a representation by URN and resolve its `generatedIdReferences`
 * into runtime `IdReference[]`.
 *
 * The manifest parameter is a mapped type `{ [P in K]: RepresentationSurfaces }`
 * with `K` inferred at the call site. This accepts the generated
 * `Representations` interface's narrow literal keys (so `keyof typeof
 * representations` stays narrow) without requiring an index signature on
 * the manifest — passing a `Record<string, ...>` parameter directly would
 * force the codegen to widen the manifest's `keyof`.
 *
 * Throws on unknown representation URN or unregistered aggregate URN.
 */
export function getGeneratedIdReferences<TLink extends Link = Link, K extends string = string>(
  representationUrn: string,
  manifest: { [P in K]: RepresentationSurfaces },
  registry: AggregateRegistry<TLink>,
): IdReference<TLink>[] {
  for (const entry of Object.values<RepresentationSurfaces>(manifest)) {
    if (entry.urn !== representationUrn) continue
    const refs = entry.generatedIdReferences ?? []
    return refs.map((ref) => convertOne(representationUrn, ref, registry))
  }
  throw new Error(`No representation with urn '${representationUrn}' found in manifest`)
}

function convertOne<TLink extends Link>(
  representationUrn: string,
  ref: GeneratedIdReference,
  registry: AggregateRegistry<TLink>,
): IdReference<TLink> {
  if (ref.kind === 'id') {
    const aggregate = lookupAggregate(representationUrn, ref.aggregateUrn, registry)
    return { aggregate, path: ref.path }
  }
  const aggregates = ref.aggregateUrns.map((urn) =>
    lookupAggregate(representationUrn, urn, registry),
  )
  return { aggregates, path: ref.path }
}

function lookupAggregate<TLink extends Link>(
  representationUrn: string,
  aggregateUrn: string,
  registry: AggregateRegistry<TLink>,
): AggregateConfig<TLink> {
  const aggregate = registry[aggregateUrn]
  if (aggregate === undefined) {
    throw new Error(
      `Representation '${representationUrn}': aggregate '${aggregateUrn}' not in registry`,
    )
  }
  return aggregate
}
