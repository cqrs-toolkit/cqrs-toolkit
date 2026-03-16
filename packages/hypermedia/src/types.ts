export namespace HypermediaTypes {
  /** e.g. "/api/storage/file-objects/{id}" */
  export type RFCTemplate = string

  export interface Link {
    rel: string
    href: string
    templated?: boolean
    type?: string
    title?: string
    /** When true, render this rel as an array (even if there's only 1). */
    collection?: boolean
  }

  export interface ActionTemplate {
    name: string // e.g., "RenameProject"
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    target: string // absolute or relative URL
    contentType?: string // default application/json
    properties?: Array<{
      name: string
      required?: boolean
      readOnly?: boolean
      value?: unknown
    }>
    schemaRef?: string // link to JSON Schema (HAL-FORMS or Hydra expects)
  }

  export interface PageView {
    self: string
    first?: string
    prev?: string
    next?: string
    last?: string
  }

  export interface ResourceDescriptor<T extends object = any> {
    /** class IRI to identify ResourceDefinition, e.g. 'storage:Rendition' */
    class: string
    /** actual data record */
    properties: T
    /** Optional fallback data to resolve values for templates */
    context?: Record<string, any>
    actions?: ActionTemplate[]
    embedded?: Record<string, ResourceDescriptor | ResourceDescriptor[]>
  }

  export interface CollectionDescriptor<
    T extends object = any,
    Counts extends object = Record<string, any>,
  > {
    members: Array<ResourceDescriptor<T> | T>
    page: PageView
    totalItems?: number
    counts?: Counts

    /** Optional context to resolve templated parameters in collection links */
    context?: Record<string, any>
  }
}
