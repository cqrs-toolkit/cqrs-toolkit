/**
 * Maps the `urn:aggregate:*` URNs declared in `cqrs-toolkit.config.ts`
 * (under each representation's `idReferences`) to the live AggregateConfig
 * objects collections wire against. `getGeneratedIdReferences` reads this
 * registry to materialise runtime `IdReference[]` from the generated
 * representation manifest.
 */

import { FileObjectAggregate } from '@cqrs-toolkit/demo-base/file-objects/domain'
import { NotebookAggregate } from '@cqrs-toolkit/demo-base/notebooks/domain'
import { NoteAggregate } from '@cqrs-toolkit/demo-base/notes/domain'
import { TodoAggregate } from '@cqrs-toolkit/demo-base/todos/domain'
import type { AggregateRegistry } from '@cqrs-toolkit/hypermedia-client'
import type { ServiceLink } from '@meticoeus/ddd-es'

export const aggregateRegistry: AggregateRegistry<ServiceLink> = {
  'urn:aggregate:nb.Note': NoteAggregate,
  'urn:aggregate:nb.Notebook': NotebookAggregate,
  'urn:aggregate:nb.Todo': TodoAggregate,
  'urn:aggregate:storage.FileObject': FileObjectAggregate,
}
