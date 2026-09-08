import {and, desc, eq, exists, inArray, sql} from 'drizzle-orm';
import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {db} from '#/db/index';
import {workspaceMembers, workspaces} from '#/db/schema';
import {verifyAuthToken} from '#/lib/auth-token';
import {isJsonObject, type JsonObject} from '#/lib/json';
import {isWorkspaceAiConfig} from './workspaceAi';

const authInput = z.object({
  token: z.string().min(1),
});

const workspaceInput = authInput.extend({
  workspaceId: z.string().uuid(),
});

const workspaceContentInput = z.custom<JsonObject>(isJsonObject);
const workspaceLayoutInput = z.custom<JsonObject>(isJsonObject);
const workspaceAiConfigInput = z
  .custom<JsonObject>(isJsonObject)
  .refine(isWorkspaceAiConfig, 'Invalid workspace AI configuration');

const serializeWorkspace = (workspace: typeof workspaces.$inferSelect) => ({
  id: workspace.id,
  name: workspace.name,
  content: workspace.content as JsonObject,
  aiConfig: workspace.aiConfig as JsonObject,
  layout: workspace.layout as JsonObject,
  revision: workspace.revision,
  createdAt: workspace.createdAt.getTime(),
  updatedAt: workspace.updatedAt.getTime(),
  lastOpenedAt: workspace.lastOpenedAt?.getTime(),
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

    const workspaceRows = await db
      .update(workspaces)
      .set({lastOpenedAt: new Date()})
      .where(
        and(
          eq(workspaces.id, data.workspaceId),
          hasWorkspaceRole(userId, data.workspaceId, [
            'owner',
            'editor',
            'viewer',
          ]),
        ),
      )
      .returning();

    const workspace = workspaceRows[0];
    if (!workspace) return null;

    return serializeWorkspace(workspace);
  });

export const createCloudWorkspace = createServerFn({method: 'POST'})
  .inputValidator(
    authInput.extend({
      name: z.string().trim().min(1).max(120),
      content: workspaceContentInput,
      layout: workspaceLayoutInput.optional(),
      aiConfig: workspaceAiConfigInput.optional(),
    }),
  )
  .handler(async ({data}) => {
    const {userId} = await verifyAuthToken(data.token);
    const now = new Date();

    const workspaceId = crypto.randomUUID();
    const [workspaceRows] = await db.batch([
      db
        .insert(workspaces)
        .values({
          id: workspaceId,
          ownerId: userId,
          name: data.name,
          content: data.content,
          layout: data.layout,
          aiConfig: data.aiConfig,
          lastOpenedAt: now,
        })
        .returning(),
      db.insert(workspaceMembers).values({
        workspaceId,
        userId,
        role: 'owner',
      }),
    ]);

    return serializeWorkspace(workspaceRows[0]);
  });

export const saveWorkspaceSnapshot = createServerFn({method: 'POST'})
  .inputValidator(
    workspaceInput.extend({
      content: workspaceContentInput,
      layout: workspaceLayoutInput,
      aiConfig: workspaceAiConfigInput,
      expectedRevision: z.number().int().nonnegative(),
    }),
  )
  .handler(async ({data}) => {
    const {userId} = await verifyAuthToken(data.token);
    const rows = await db
      .update(workspaces)
      .set({
        content: data.content,
        layout: data.layout,
        aiConfig: data.aiConfig,
        revision: sql`${workspaces.revision} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workspaces.id, data.workspaceId),
          eq(workspaces.revision, data.expectedRevision),
          hasWorkspaceRole(userId, data.workspaceId, ['owner', 'editor']),
        ),
      )
      .returning();

    if (rows[0]) return serializeWorkspace(rows[0]);

    await assertWorkspaceRole(userId, data.workspaceId, ['owner', 'editor']);
    throw new Error(
      'Workspace changed in another session. Reload before saving again.',
    );
  });

export const renameCloudWorkspace = createServerFn({method: 'POST'})
  .inputValidator(
    workspaceInput.extend({
      name: z.string().trim().min(1).max(120),
    }),
  )
  .handler(async ({data}) => {
    const {userId} = await verifyAuthToken(data.token);
    const rows = await db
      .update(workspaces)
      .set({name: data.name, updatedAt: new Date()})
      .where(
        and(
          eq(workspaces.id, data.workspaceId),
          hasWorkspaceRole(userId, data.workspaceId, ['owner', 'editor']),
        ),
      )
      .returning();

    if (!rows[0]) throw new Error('Workspace not found');
    return serializeWorkspace(rows[0]);
  });

export const deleteCloudWorkspace = createServerFn({method: 'POST'})
  .inputValidator(workspaceInput)
  .handler(async ({data}) => {
    const {userId} = await verifyAuthToken(data.token);
    const rows = await db
      .delete(workspaces)
      .where(
        and(
          eq(workspaces.id, data.workspaceId),
          hasWorkspaceRole(userId, data.workspaceId, ['owner']),
        ),
      )
      .returning({id: workspaces.id});
    if (!rows[0]) throw new Error('Workspace not found');
    return {ok: true};
  });

function hasWorkspaceRole(
  userId: string,
  workspaceId: string,
  roles: string[],
) {
  return exists(
    db
      .select({workspaceId: workspaceMembers.workspaceId})
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
          inArray(workspaceMembers.role, roles),
        ),
      ),
  );
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
