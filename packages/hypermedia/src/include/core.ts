import { HypermediaTypes } from '../types.js'

export type ResourceDescriptor<T extends object = any> = HypermediaTypes.ResourceDescriptor<T>

export type Cardinality = 'one' | 'many'

export interface BaseResolverParams {
  keys?: string[]
}

// For planner typing convenience:
export type OneMap = Map<string, ResourceDescriptor<any> | undefined>
export type ManyMap = Map<string, ResourceDescriptor<any>[]>

// DataLoader-style resolvers (return a Map keyed by the input parent key)
export type ResolveOne<Params extends BaseResolverParams, Locals, Context> = (
  params: Params,
  locals: Locals,
  context: Context,
) => Promise<OneMap | undefined>

export type ResolveMany<Params extends BaseResolverParams, Locals, Context> = (
  params: Params,
  locals: Locals,
  context: Context,
) => Promise<ManyMap | undefined>

/**
 * EmbeddableSpec: describes a top-level resolvable token.
 * NOTE: no child/parent nesting here; callers will compose in route formatters.
 */
export interface EmbeddableSpec<
  Card extends Cardinality,
  Params extends BaseResolverParams,
  Locals,
  Context,
> {
  /** exact token clients pass (e.g. "pms:DataTag") */
  className: string
  /** 'one' | 'many' */
  cardinality: Card
  /** Single resolver for this class */
  resolve: Card extends 'one'
    ? ResolveOne<Params, Locals, Context>
    : ResolveMany<Params, Locals, Context>
  /** Optional: only used to derive keys for this child when params[class].keys not provided */
  parent?: { className: string }
}

// ————— Route-local typing helpers —————
export type AnySpec<Locals, Context> =
  | EmbeddableSpec<'one', any, Locals, Context>
  | EmbeddableSpec<'many', any, Locals, Context>

type ParamsOf<S> = S extends EmbeddableSpec<any, infer Params, any, any> ? Params : never
type ClassNameOf<S> = S extends EmbeddableSpec<any, any, any, any> ? S['className'] : never
type CardOf<S> = S extends EmbeddableSpec<infer Card, any, any, any> ? Card : never

export type ParamMapFromSpecs<Specs extends readonly AnySpec<any, any>[]> = {
  [K in ClassNameOf<Specs[number]>]: ParamsOf<Extract<Specs[number], { className: K }>>
}

export type EmbeddedOutputOne = {
  cardinality: 'one'
  map?: OneMap
  /** present when caller asked to skip fetching; map may still be present if provided via prefetched */
  skipped?: true
}

export type EmbeddedOutputMany = {
  cardinality: 'many'
  map?: ManyMap
  /** present when caller asked to skip fetching; map may still be present if provided via prefetched */
  skipped?: true
}

/**
 * What resolve() returns on success, keyed by className.
 * No nesting; formatter composes.
 */
export type EmbeddedOutput<Specs extends readonly AnySpec<any, any>[]> = {
  [K in ClassNameOf<Specs[number]>]: CardOf<Extract<Specs[number], { className: K }>> extends 'one'
    ? EmbeddedOutputOne
    : EmbeddedOutputMany
}
