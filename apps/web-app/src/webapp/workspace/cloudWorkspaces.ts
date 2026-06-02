import {and, desc, eq, sql} from 'drizzle-orm';
import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {db} from '#/db/index';
import {workspaceMembers, workspaces, worksheets} from '#/db/schema';
import {verifyAuthToken} from '#/lib/auth-token';
import {isJsonObject, type JsonObject} from '#/lib/json';

const authInput = z.object({
  token: z.string().min(1),
});

const workspaceInput = authInput.extend({
  workspaceId: z.string().uuid(),
});

const blockDocumentContentInput = z.custom<JsonObject>(isJsonObject);
const workspaceLayoutInput = z.custom<JsonObject>(isJsonObject);

const serializeWorkspace = (workspace: typeof workspaces.$inferSelect) => ({
  id: workspace.id,
  name: workspace.name,
  layout: workspace.layout as JsonObject,
  createdAt: workspace.createdAt.getTime(),
  updatedAt: workspace.updatedAt.getTime(),
  lastOpenedAt: workspace.lastOpenedAt?.getTime(),
});

const serializeWorksheet = (worksheet: typeof worksheets.$inferSelect) => ({
  id: worksheet.id,
  workspaceId: worksheet.workspaceId,
  title: worksheet.title,
  content: worksheet.content as JsonObject,
  createdAt: worksheet.createdAt.getTime(),
  updatedAt: worksheet.updatedAt.getTime(),
});

export const listCloudWorkspaces = createServerFn({method: 'POST'})
  .inputValidator(authInput)
  .handler(async ({data}) => {
    const {userId} = await verifyAuthToken(data.token);

    const rows = await db
      .select({workspace: workspaces})
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, userId))
      .orderBy(
        desc(
          sql`coalesce(${workspaces.lastOpenedAt}, ${workspaces.updatedAt}, ${workspaces.createdAt})`,
        ),
      );

    return rows.map((row) => serializeWorkspace(row.workspace));
  });

export const getCloudWorkspace = createServerFn({method: 'POST'})
  .inputValidator(workspaceInput)
  .handler(async ({data}) => {
    const {userId} = await verifyAuthToken(data.token);
    await assertWorkspaceMember(userId, data.workspaceId);

    const workspaceRows = await db
      .update(workspaces)
      .set({lastOpenedAt: new Date()})
      .where(eq(workspaces.id, data.workspaceId))
      .returning();

    const workspace = workspaceRows[0];
    if (!workspace) return null;

    const worksheetRows = await db
      .select()
      .from(worksheets)
      .where(eq(worksheets.workspaceId, data.workspaceId))
      .orderBy(desc(worksheets.updatedAt));

    return {
      ...serializeWorkspace(workspace),
      worksheets: worksheetRows.map(serializeWorksheet),
    };
  });

export const createCloudWorkspace = createServerFn({method: 'POST'})
  .inputValidator(
    authInput.extend({
      name: z.string().trim().min(1).max(120),
      layout: workspaceLayoutInput.optional(),
      worksheetTitle: z.string().trim().min(1).max(120).default('Worksheet'),
      worksheetContent: blockDocumentContentInput.default({
        type: 'doc',
        content: [],
      }),
    }),
  )
  .handler(async ({data}) => {
    const {userId} = await verifyAuthToken(data.token);
    const now = new Date();

    const workspaceRows = await db
      .insert(workspaces)
      .values({
        ownerId: userId,
        name: data.name,
        layout: data.layout,
        lastOpenedAt: now,
      })
      .returning();

    const workspace = workspaceRows[0];

    await db.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId,
      role: 'owner',
    });

    const worksheetRows = await db
      .insert(worksheets)
      .values({
        workspaceId: workspace.id,
        ownerId: userId,
        title: data.worksheetTitle,
        content: data.worksheetContent,
      })
      .returning();

    return {
      ...serializeWorkspace(workspace),
      worksheets: worksheetRows.map(serializeWorksheet),
    };
  });

export const saveWorkspaceLayout = createServerFn({method: 'POST'})
  .inputValidator(
    workspaceInput.extend({
      layout: workspaceLayoutInput,
    }),
  )
  .handler(async ({data}) => {
    const {userId} = await verifyAuthToken(data.token);
    await assertWorkspaceRole(userId, data.workspaceId, ['owner', 'editor']);

    const rows = await db
      .update(workspaces)
      .set({layout: data.layout, updatedAt: new Date()})
      .where(eq(workspaces.id, data.workspaceId))
      .returning();

    return rows[0] ? serializeWorkspace(rows[0]) : null;
  });

export const renameCloudWorkspace = createServerFn({method: 'POST'})
  .inputValidator(
    workspaceInput.extend({
      name: z.string().trim().min(1).max(120),
    }),
  )
  .handler(async ({data}) => {
    const {userId} = await verifyAuthToken(data.token);
    await assertWorkspaceRole(userId, data.workspaceId, ['owner', 'editor']);

    const rows = await db
      .update(workspaces)
      .set({name: data.name, updatedAt: new Date()})
      .where(eq(workspaces.id, data.workspaceId))
      .returning();

    return rows[0] ? serializeWorkspace(rows[0]) : null;
  });

export const deleteCloudWorkspace = createServerFn({method: 'POST'})
  .inputValidator(workspaceInput)
  .handler(async ({data}) => {
    const {userId} = await verifyAuthToken(data.token);
    await assertWorkspaceRole(userId, data.workspaceId, ['owner']);

    await db.delete(workspaces).where(eq(workspaces.id, data.workspaceId));
    return {ok: true};
  });

async function assertWorkspaceMember(userId: string, workspaceId: string) {
  await assertWorkspaceRole(userId, workspaceId, ['owner', 'editor', 'viewer']);
}

async function assertWorkspaceRole(
  userId: string,
  workspaceId: string,
  roles: string[],
) {
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

  const membership = rows[0];
  if (!membership || !roles.includes(membership.role)) {
    throw new Error('Workspace not found');
  }
}
