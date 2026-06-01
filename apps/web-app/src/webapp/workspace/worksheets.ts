import {and, eq} from 'drizzle-orm';
import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {db} from '#/db/index';
import {workspaceMembers, worksheets} from '#/db/schema';
import {verifyAuthToken} from '#/lib/auth-token';
import {isJsonObject, type JsonObject} from '#/lib/json';

const authInput = z.object({
  token: z.string().min(1),
});

const worksheetInput = authInput.extend({
  workspaceId: z.string().uuid(),
  worksheetId: z.string().uuid(),
});

const blockDocumentContentInput = z.custom<JsonObject>(isJsonObject);

const serializeWorksheet = (worksheet: typeof worksheets.$inferSelect) => ({
  id: worksheet.id,
  workspaceId: worksheet.workspaceId,
  title: worksheet.title,
  content: worksheet.content as JsonObject,
  createdAt: worksheet.createdAt.getTime(),
  updatedAt: worksheet.updatedAt.getTime(),
});

export const createWorksheet = createServerFn({method: 'POST'})
  .inputValidator(
    authInput.extend({
      workspaceId: z.string().uuid(),
      title: z.string().trim().min(1).max(120).default('Worksheet'),
      content: blockDocumentContentInput.default({type: 'doc', content: []}),
    }),
  )
  .handler(async ({data}) => {
    const {userId} = await verifyAuthToken(data.token);
    await assertCanEditWorkspace(userId, data.workspaceId);

    const rows = await db
      .insert(worksheets)
      .values({
        workspaceId: data.workspaceId,
        ownerId: userId,
        title: data.title,
        content: data.content,
      })
      .returning();

    return serializeWorksheet(rows[0]);
  });

export const saveWorksheetContent = createServerFn({method: 'POST'})
  .inputValidator(
    worksheetInput.extend({
      title: z.string().trim().min(1).max(120).optional(),
      content: blockDocumentContentInput,
    }),
  )
  .handler(async ({data}) => {
    const {userId} = await verifyAuthToken(data.token);
    await assertCanEditWorkspace(userId, data.workspaceId);

    const rows = await db
      .update(worksheets)
      .set({
        title: data.title,
        content: data.content,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(worksheets.id, data.worksheetId),
          eq(worksheets.workspaceId, data.workspaceId),
        ),
      )
      .returning();

    return rows[0] ? serializeWorksheet(rows[0]) : null;
  });

async function assertCanEditWorkspace(userId: string, workspaceId: string) {
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

  const role = rows[0]?.role;
  if (role !== 'owner' && role !== 'editor') {
    throw new Error('Workspace not found');
  }
}
