export const USER_STORAGE_LIMIT_BYTES = 100 * 1024 * 1024;
export const PARQUET_UPLOAD_LIMIT_BYTES = 50 * 1024 * 1024;

export function createR2ObjectKey({
  userId,
  workspaceId,
  fileId,
}: {
  userId: string;
  workspaceId: string;
  fileId: string;
}) {
  return `users/${sanitizePathSegment(userId)}/workspaces/${sanitizePathSegment(
    workspaceId,
  )}/${sanitizePathSegment(fileId)}.parquet`;
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
}
