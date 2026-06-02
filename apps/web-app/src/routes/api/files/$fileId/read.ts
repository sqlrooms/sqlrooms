import {createFileRoute} from '@tanstack/react-router';

export const Route = createFileRoute('/api/files/$fileId/read')({
  server: {
    handlers: {
      GET: ({params, request}) => handleFileReadRequest(params.fileId, request),
    },
  },
});

async function handleFileReadRequest(fileId: string, request: Request) {
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get('workspaceId');
  const token = url.searchParams.get('token');

  if (!workspaceId || !token) {
    return jsonError('Missing file read fields.', 400);
  }

  try {
    const [{verifyAuthToken}, fileStorage] = await Promise.all([
      import('#/lib/auth-token'),
      import('#/webapp/files/fileStorage.server'),
    ]);
    const {userId} = await verifyAuthToken(token);
    const {file, object} = await fileStorage.getFileObjectForRead({
      userId,
      workspaceId,
      fileId,
    });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('content-type', file.mimeType);
    headers.set('cache-control', 'private, max-age=300');
    headers.set('etag', object.httpEtag ?? '');
    headers.set('content-length', String(object.size));
    return new Response(object.body, {headers});
  } catch (error) {
    if (isFileStorageError(error)) {
      return jsonError(error.message, error.status, error.code);
    }
    console.error('Could not read file', error);
    return jsonError('Could not read file.', 500);
  }
}

function jsonError(message: string, status: number, code = 'ERROR') {
  return Response.json({error: message, code}, {status});
}

function isFileStorageError(
  error: unknown,
): error is {message: string; status: number; code: string} {
  return (
    error instanceof Error &&
    'status' in error &&
    typeof error.status === 'number' &&
    'code' in error &&
    typeof error.code === 'string'
  );
}
