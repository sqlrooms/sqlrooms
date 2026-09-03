import {env} from 'cloudflare:workers';
import {and, eq, sql} from 'drizzle-orm';
import {formatBytes as formatByteCount} from '@sqlrooms/utils';
import {db} from '#/db/index';
import {files, userStorageUsage, workspaceMembers} from '#/db/schema';
import {
  PARQUET_UPLOAD_LIMIT_BYTES,
  USER_STORAGE_LIMIT_BYTES,
  createR2ObjectKey,
} from './fileLimits';
import {parseByteRangeHeader} from './fileReadRange';

const PARQUET_MIME_TYPE = 'application/vnd.apache.parquet';
const PRESIGNED_UPLOAD_EXPIRES_SECONDS = 10 * 60;

export class FileStorageError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = 'FILE_STORAGE_ERROR',
  ) {
    super(message);
  }
}

export type FileUploadIntent = {
  fileId: string;
  objectKey: string;
  uploadUrl: string;
  contentType: typeof PARQUET_MIME_TYPE;
  expiresAt: number;
};

export async function createFileUploadIntent({
  userId,
  workspaceId,
  parquetSizeBytes,
}: {
  userId: string;
  workspaceId: string;
  parquetSizeBytes: number;
}): Promise<FileUploadIntent> {
  await assertWorkspaceMember(userId, workspaceId);
  assertParquetSize(parquetSizeBytes);
  await assertStorageAvailable(userId, parquetSizeBytes);

  const fileId = crypto.randomUUID();
  const objectKey = createR2ObjectKey({userId, workspaceId, fileId});
  const uploadUrl = await createR2PresignedPutUrl({
    objectKey,
    contentLength: parquetSizeBytes,
    expiresSeconds: PRESIGNED_UPLOAD_EXPIRES_SECONDS,
  });

  return {
    fileId,
    objectKey,
    uploadUrl,
    contentType: PARQUET_MIME_TYPE,
    expiresAt: Date.now() + PRESIGNED_UPLOAD_EXPIRES_SECONDS * 1000,
  };
}

export async function finalizeFileUpload({
  userId,
  workspaceId,
  fileId,
  objectKey,
  originalName,
  tableName,
  parquetSizeBytes,
  sourceSizeBytes,
  rowCount,
  contentHash,
}: {
  userId: string;
  workspaceId: string;
  fileId: string;
  objectKey: string;
  originalName: string;
  tableName: string;
  parquetSizeBytes: number;
  sourceSizeBytes?: number;
  rowCount?: number;
  contentHash?: string;
}) {
  await assertWorkspaceMember(userId, workspaceId);
  assertParquetSize(parquetSizeBytes);
  assertExpectedObjectKey({userId, workspaceId, fileId, objectKey});
  const existingFile = await findStoredFile(fileId, objectKey);
  if (existingFile) return existingFile;

  const bucket = getUserFilesBucket();
  const uploadedObject = await bucket.head(objectKey);
  if (!uploadedObject) {
    throw new FileStorageError(
      'Uploaded file was not found.',
      404,
      'NOT_FOUND',
    );
  }
  if (uploadedObject.size !== parquetSizeBytes) {
    await bucket.delete(objectKey);
    throw new FileStorageError(
      'Uploaded file size does not match the upload intent.',
      400,
      'UPLOAD_SIZE_MISMATCH',
    );
  }

  const now = new Date();
  try {
    const result = await db.execute<{id: string}>(sql`
      with reservation as (
        insert into ${userStorageUsage}
          (user_id, used_bytes, limit_bytes, updated_at)
        select
          ${userId},
          ${parquetSizeBytes},
          ${USER_STORAGE_LIMIT_BYTES},
          ${now}
        from ${workspaceMembers}
        where ${workspaceMembers.workspaceId} = ${workspaceId}
          and ${workspaceMembers.userId} = ${userId}
        on conflict (user_id) do update set
          used_bytes = ${userStorageUsage.usedBytes} + ${parquetSizeBytes},
          updated_at = ${now}
        where ${userStorageUsage.usedBytes} + ${parquetSizeBytes}
          <= ${userStorageUsage.limitBytes}
        returning user_id
      )
      insert into ${files} (
        id,
        owner_id,
        workspace_id,
        original_name,
        table_name,
        object_key,
        mime_type,
        size_bytes,
        source_size_bytes,
        row_count,
        content_hash
      )
      select
        ${fileId},
        ${userId},
        ${workspaceId},
        ${originalName},
        ${tableName},
        ${objectKey},
        ${PARQUET_MIME_TYPE},
        ${parquetSizeBytes},
        ${sourceSizeBytes ?? null},
        ${rowCount ?? null},
        ${contentHash ?? null}
      from reservation
      returning id
    `);

    if (!result.rows[0]) {
      await bucket.delete(objectKey);
      await assertWorkspaceMember(userId, workspaceId);
      throw new FileStorageError(
        `This upload would exceed the ${formatBytes(USER_STORAGE_LIMIT_BYTES)} storage limit.`,
        403,
        'STORAGE_LIMIT_REACHED',
      );
    }
  } catch (error) {
    if (error instanceof FileStorageError) throw error;
    const concurrentFile = await findStoredFile(fileId, objectKey);
    if (concurrentFile) return concurrentFile;
    await bucket.delete(objectKey);
    throw new FileStorageError('Could not finalize upload.', 500);
  }

  const file = await findStoredFile(fileId, objectKey);
  if (file) return file;

  await bucket.delete(objectKey);
  throw new FileStorageError('Could not finalize upload.', 500);
}

async function findStoredFile(fileId: string, objectKey: string) {
  const rows = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.objectKey, objectKey)))
    .limit(1);
  return rows[0];
}

export async function getFileObjectForRead({
  userId,
  workspaceId,
  fileId,
  rangeHeader,
}: {
  userId: string;
  workspaceId: string;
  fileId: string;
  rangeHeader?: string | null;
}) {
  await assertWorkspaceMember(userId, workspaceId);

  const rows = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.workspaceId, workspaceId)))
    .limit(1);
  const file = rows[0];
  if (!file) {
    throw new FileStorageError('File not found.', 404, 'NOT_FOUND');
  }

  const parsedRange = parseByteRangeHeader(rangeHeader ?? null, file.sizeBytes);
  if (rangeHeader && !parsedRange) {
    throw new FileStorageError('Invalid file range.', 416, 'INVALID_RANGE');
  }

  const object = await getUserFilesBucket().get(
    file.objectKey,
    parsedRange ? {range: parsedRange.range} : undefined,
  );
  if (!object) {
    throw new FileStorageError('Stored file not found.', 404, 'NOT_FOUND');
  }

  return {file, object, range: parsedRange};
}

export async function deleteFile({
  userId,
  workspaceId,
  fileId,
}: {
  userId: string;
  workspaceId: string;
  fileId: string;
}) {
  await assertWorkspaceMember(userId, workspaceId);

  const rows = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.id, fileId),
        eq(files.workspaceId, workspaceId),
        eq(files.ownerId, userId),
      ),
    )
    .limit(1);
  const file = rows[0];
  if (!file) {
    throw new FileStorageError('File not found.', 404, 'NOT_FOUND');
  }

  await getUserFilesBucket().delete(file.objectKey);
  await db
    .delete(files)
    .where(
      and(
        eq(files.id, fileId),
        eq(files.workspaceId, workspaceId),
        eq(files.ownerId, userId),
      ),
    );
  await db
    .insert(userStorageUsage)
    .values({
      userId,
      usedBytes: 0,
      limitBytes: USER_STORAGE_LIMIT_BYTES,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userStorageUsage.userId,
      set: {
        usedBytes: sql`greatest(${userStorageUsage.usedBytes} - ${file.sizeBytes}, 0)`,
        updatedAt: new Date(),
      },
    });

  return file;
}

async function assertWorkspaceMember(userId: string, workspaceId: string) {
  const rows = await db
    .select({role: workspaceMembers.role})
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    )
    .limit(1);

  if (!rows[0]) {
    throw new FileStorageError('Workspace not found.', 404, 'NOT_FOUND');
  }
}

function assertParquetSize(sizeBytes: number) {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new FileStorageError('Invalid Parquet file size.', 400);
  }
  if (sizeBytes > PARQUET_UPLOAD_LIMIT_BYTES) {
    throw new FileStorageError(
      `Exported Parquet is larger than ${formatBytes(PARQUET_UPLOAD_LIMIT_BYTES)}.`,
      413,
      'PARQUET_TOO_LARGE',
    );
  }
}

async function assertStorageAvailable(userId: string, nextBytes: number) {
  const rows = await db
    .select()
    .from(userStorageUsage)
    .where(eq(userStorageUsage.userId, userId))
    .limit(1);
  const usage = rows[0] ?? {
    usedBytes: 0,
    limitBytes: USER_STORAGE_LIMIT_BYTES,
  };

  if (usage.usedBytes + nextBytes > usage.limitBytes) {
    throw new FileStorageError(
      `This upload would exceed the ${formatBytes(usage.limitBytes)} storage limit.`,
      403,
      'STORAGE_LIMIT_REACHED',
    );
  }
}

function assertExpectedObjectKey({
  userId,
  workspaceId,
  fileId,
  objectKey,
}: {
  userId: string;
  workspaceId: string;
  fileId: string;
  objectKey: string;
}) {
  const expected = createR2ObjectKey({userId, workspaceId, fileId});
  if (objectKey !== expected) {
    throw new FileStorageError('Invalid upload object key.', 400);
  }
}

async function createR2PresignedPutUrl({
  objectKey,
  contentLength,
  expiresSeconds,
}: {
  objectKey: string;
  contentLength: number;
  expiresSeconds: number;
}) {
  const accountId = getRequiredEnv('R2_ACCOUNT_ID');
  const bucketName = getRequiredEnv('R2_BUCKET_NAME');
  const accessKeyId = getRequiredEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = getRequiredEnv('R2_SECRET_ACCESS_KEY');
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const now = new Date();
  const date = toAmzDate(now);
  const dateScope = date.slice(0, 8);
  const region = 'auto';
  const service = 's3';
  const credentialScope = `${dateScope}/${region}/${service}/aws4_request`;
  const canonicalUri = `/${encodePathSegment(bucketName)}/${objectKey
    .split('/')
    .map(encodePathSegment)
    .join('/')}`;
  const query = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
    'X-Amz-Date': date,
    'X-Amz-Expires': String(expiresSeconds),
    'X-Amz-SignedHeaders': 'content-length;host',
  });
  const canonicalQuery = canonicalizeQuery(query);
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQuery,
    `content-length:${contentLength}`,
    `host:${host}`,
    '',
    'content-length;host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    date,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');
  const signingKey = await getSignatureKey({
    secretAccessKey,
    dateScope,
    region,
    service,
  });
  const signature = await hmacHex(signingKey, stringToSign);
  query.set('X-Amz-Signature', signature);

  return `https://${host}${canonicalUri}?${canonicalizeQuery(query)}`;
}

function getUserFilesBucket() {
  const bucket = env.USER_FILES_BUCKET;
  if (!bucket) {
    throw new FileStorageError(
      'USER_FILES_BUCKET is not configured.',
      500,
      'USER_FILES_BUCKET_MISSING',
    );
  }
  return bucket;
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new FileStorageError(
      `${name} is not configured.`,
      500,
      'ENV_MISSING',
    );
  }
  return value;
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function canonicalizeQuery(query: URLSearchParams) {
  return Array.from(query.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join('&');
}

async function sha256Hex(value: string) {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return bytesToHex(new Uint8Array(hash));
}

async function hmacBytes(key: Uint8Array, value: string) {
  const keyBytes = new Uint8Array(key.byteLength);
  keyBytes.set(key);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(value),
  );
  return new Uint8Array(signature);
}

async function hmacHex(key: Uint8Array, value: string) {
  return bytesToHex(await hmacBytes(key, value));
}

async function getSignatureKey({
  secretAccessKey,
  dateScope,
  region,
  service,
}: {
  secretAccessKey: string;
  dateScope: string;
  region: string;
  service: string;
}) {
  const dateKey = await hmacBytes(
    new TextEncoder().encode(`AWS4${secretAccessKey}`),
    dateScope,
  );
  const regionKey = await hmacBytes(dateKey, region);
  const serviceKey = await hmacBytes(regionKey, service);
  return hmacBytes(serviceKey, 'aws4_request');
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  return formatByteCount(bytes);
}
