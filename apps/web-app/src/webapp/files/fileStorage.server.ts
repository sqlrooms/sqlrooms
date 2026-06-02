import {env} from 'cloudflare:workers';
import {and, eq, sql} from 'drizzle-orm';
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
  await assertStorageAvailable(userId, parquetSizeBytes);

  const uploadedObject = await getUserFilesBucket().head(objectKey);
  if (!uploadedObject) {
    throw new FileStorageError(
      'Uploaded file was not found.',
      404,
      'NOT_FOUND',
    );
  }
  if (uploadedObject.size !== parquetSizeBytes) {
    throw new FileStorageError(
      'Uploaded file size does not match the upload intent.',
      400,
      'UPLOAD_SIZE_MISMATCH',
    );
  }

  const now = new Date();
  const rows = await db
    .insert(files)
    .values({
      id: fileId,
      ownerId: userId,
      workspaceId,
      originalName,
      tableName,
      objectKey,
      mimeType: PARQUET_MIME_TYPE,
      sizeBytes: parquetSizeBytes,
      sourceSizeBytes,
      rowCount,
      contentHash,
    })
    .onConflictDoNothing()
    .returning();

  const file = rows[0];
  if (!file) {
    const existing = await db
      .select()
      .from(files)
      .where(eq(files.objectKey, objectKey))
      .limit(1);
    if (!existing[0]) {
      throw new FileStorageError('Could not finalize upload.', 500);
    }
    return existing[0];
  }

  await db
    .insert(userStorageUsage)
    .values({
      userId,
      usedBytes: parquetSizeBytes,
      limitBytes: USER_STORAGE_LIMIT_BYTES,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userStorageUsage.userId,
      set: {
        usedBytes: sql`${userStorageUsage.usedBytes} + ${parquetSizeBytes}`,
        updatedAt: now,
      },
    });

  return file;
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
  expiresSeconds,
}: {
  objectKey: string;
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
    'X-Amz-SignedHeaders': 'host',
  });
  const canonicalQuery = canonicalizeQuery(query);
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQuery,
    `host:${host}`,
    '',
    'host',
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
  const units = ['B', 'KB', 'MB', 'GB'] as const;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}
