import {and, desc, eq} from 'drizzle-orm';
import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {db} from '#/db/index';
import {files, workspaceMembers} from '#/db/schema';
import {verifyAuthToken} from '#/lib/auth-token';
import {
  createFileUploadIntent as createStorageFileUploadIntent,
  finalizeFileUpload as finalizeStorageFileUpload,
} from '../files/fileStorage.server';

const workspaceFilesInput = z.object({
  token: z.string().min(1),
  workspaceId: z.string().uuid(),
});

const serializeFile = (file: typeof files.$inferSelect) => ({
  id: file.id,
  workspaceId: file.workspaceId,
  originalName: file.originalName,
  tableName: file.tableName,
  sizeBytes: file.sizeBytes,
  sourceSizeBytes: file.sourceSizeBytes,
  rowCount: file.rowCount,
  createdAt: file.createdAt.getTime(),
});

export const listWorkspaceFiles = createServerFn({method: 'POST'})
  .inputValidator(workspaceFilesInput)
  .handler(async ({data}) => {
    const {userId} = await verifyAuthToken(data.token);
    await assertWorkspaceMember(userId, data.workspaceId);

    const rows = await db
      .select()
      .from(files)
      .where(eq(files.workspaceId, data.workspaceId))
      .orderBy(desc(files.createdAt));

    return rows.map(serializeFile);
  });

export const createFileUploadIntent = createServerFn({method: 'POST'})
  .inputValidator(
    workspaceFilesInput.extend({
      parquetSizeBytes: z.number().int().positive(),
    }),
  )
  .handler(async ({data}) => {
    const {userId} = await verifyAuthToken(data.token);
    return createStorageFileUploadIntent({
      userId,
      workspaceId: data.workspaceId,
      parquetSizeBytes: data.parquetSizeBytes,
    });
  });

export const finalizeFileUpload = createServerFn({method: 'POST'})
  .inputValidator(
    workspaceFilesInput.extend({
      fileId: z.string().uuid(),
      objectKey: z.string().min(1),
      originalName: z.string().trim().min(1).max(240),
      tableName: z.string().trim().min(1).max(120),
      parquetSizeBytes: z.number().int().positive(),
      sourceSizeBytes: z.number().int().positive().optional(),
      rowCount: z.number().int().nonnegative().optional(),
      contentHash: z.string().min(1).max(128).optional(),
    }),
  )
  .handler(async ({data}) => {
    const {userId} = await verifyAuthToken(data.token);
    const file = await finalizeStorageFileUpload({
      userId,
      workspaceId: data.workspaceId,
      fileId: data.fileId,
      objectKey: data.objectKey,
      originalName: data.originalName,
      tableName: data.tableName,
      parquetSizeBytes: data.parquetSizeBytes,
      sourceSizeBytes: data.sourceSizeBytes,
      rowCount: data.rowCount,
      contentHash: data.contentHash,
    });

    return serializeFile(file);
  });

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
    throw new Error('Workspace not found');
  }
}
