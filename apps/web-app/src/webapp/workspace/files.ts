import {and, desc, eq} from 'drizzle-orm';
import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {db} from '#/db/index';
import {files, workspaceMembers} from '#/db/schema';
import {verifyAuthToken} from '#/lib/auth-token';

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
