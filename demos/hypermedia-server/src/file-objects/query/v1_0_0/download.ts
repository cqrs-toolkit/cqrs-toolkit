/**
 * FileObject v1.0.0 download operation — 307 redirect to a presigned URL.
 */

import { HydraDoc } from '@cqrs-toolkit/hypermedia'
import { PROBLEM_CONTENT_TYPE, ProblemSchema } from '../../../problems/index.js'

export const FileObjectDownloadOpV1_0_0 = new HydraDoc.OperationLink({
  id: 'urn:representation:storage.FileObjectDownload:1.0.0',
  version: '1.0.0',
  operation: {
    profile: 'urn:profile:storage.FileObjectDownload:1.0.0',
    operationId: 'downloadFileObject',
    formats: ['application/json'],
    template: {
      id: '#storage-file-object-download-v1_0_0',
      template: '/api/file-objects/{id}/download',
      mappings: [{ variable: 'id', property: 'storage:fileObjectId', required: true }],
    },
    responses: [
      {
        code: 307,
        schema: HydraDoc.NO_BODY,
        description: 'Redirect to a presigned download URL.',
        responseHeaders: ['Location'],
      },
      {
        code: 404,
        contentType: PROBLEM_CONTENT_TYPE,
        schema: ProblemSchema,
        description: 'File object not found.',
      },
    ],
  },
})
