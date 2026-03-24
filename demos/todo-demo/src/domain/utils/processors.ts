import { ProcessorContext, serializeBigint } from '@cqrs-toolkit/client'

export function addRevision<V extends { latestRevision?: string | undefined }>(
  ctx: ProcessorContext,
  model: V,
): V {
  if (ctx.persistence !== 'Anticipated') {
    model.latestRevision = serializeBigint(ctx.revision)
  }
  return model
}
