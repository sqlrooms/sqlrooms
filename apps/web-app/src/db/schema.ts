import {relations, sql} from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const usersProfile = pgTable('users_profile', {
  userId: text('user_id').primaryKey(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at', {withTimezone: true})
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', {withTimezone: true})
    .defaultNow()
    .notNull(),
});

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid().defaultRandom().primaryKey(),
    ownerId: text('owner_id').notNull(),
    name: text().notNull(),
    aiConfig: jsonb('ai_config')
      .notNull()
      .default({sessions: [], openSessionTabs: []}),
    layout: jsonb()
      .notNull()
      .default({
        type: 'split',
        id: 'workspace-root-layout',
        direction: 'row',
        children: [
          {
            type: 'panel',
            id: 'assistant-panel',
            panel: 'assistant',
            defaultSize: '320px',
            minSize: '260px',
            maxSize: '560px',
            collapsible: true,
            collapsedSize: 0,
          },
          {
            type: 'panel',
            id: 'worksheet-panel',
            panel: 'worksheet',
            defaultSize: '75%',
            minSize: '360px',
          },
        ],
      }),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
    lastOpenedAt: timestamp('last_opened_at', {withTimezone: true}),
  },
  (table) => [
    index('workspaces_owner_updated_at_idx').on(table.ownerId, table.updatedAt),
  ],
);

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, {onDelete: 'cascade'}),
    userId: text('user_id').notNull(),
    role: text().default('owner').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.workspaceId, table.userId],
      name: 'workspace_members_workspace_user_pk',
    }),
    index('workspace_members_user_idx').on(table.userId),
    check(
      'workspace_members_role_check',
      sql`${table.role} in ('owner', 'editor', 'viewer')`,
    ),
  ],
);

export const worksheets = pgTable(
  'worksheets',
  {
    id: uuid().defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, {onDelete: 'cascade'}),
    ownerId: text('owner_id').notNull(),
    title: text().notNull(),
    content: jsonb().notNull().default({type: 'doc', content: []}),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('worksheets_workspace_updated_at_idx').on(
      table.workspaceId,
      table.updatedAt,
    ),
  ],
);

export const files = pgTable(
  'files',
  {
    id: uuid().defaultRandom().primaryKey(),
    ownerId: text('owner_id').notNull(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, {onDelete: 'cascade'}),
    originalName: text('original_name').notNull(),
    tableName: text('table_name').notNull(),
    objectKey: text('object_key').notNull(),
    mimeType: text('mime_type')
      .default('application/vnd.apache.parquet')
      .notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sourceSizeBytes: integer('source_size_bytes'),
    rowCount: integer('row_count'),
    contentHash: text('content_hash'),
    status: text().default('active').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('files_object_key_idx').on(table.objectKey),
    index('files_workspace_created_at_idx').on(
      table.workspaceId,
      table.createdAt,
    ),
    index('files_owner_created_at_idx').on(table.ownerId, table.createdAt),
  ],
);

export const userStorageUsage = pgTable('user_storage_usage', {
  userId: text('user_id').primaryKey(),
  usedBytes: bigint('used_bytes', {mode: 'number'}).default(0).notNull(),
  limitBytes: bigint('limit_bytes', {mode: 'number'})
    .default(100 * 1024 * 1024)
    .notNull(),
  updatedAt: timestamp('updated_at', {withTimezone: true})
    .defaultNow()
    .notNull(),
});

export const aiUsageEvents = pgTable(
  'ai_usage_events',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    provider: text().notNull(),
    model: text().notNull(),
    purpose: text().default('chat').notNull(),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    reasoningTokens: integer('reasoning_tokens'),
    cachedInputTokens: integer('cached_input_tokens'),
    costUsd: real('cost_usd'),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('ai_usage_events_user_created_at_idx').on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export const workspaceRelations = relations(workspaces, ({many}) => ({
  members: many(workspaceMembers),
  worksheets: many(worksheets),
  files: many(files),
}));

export const worksheetRelations = relations(worksheets, ({one}) => ({
  workspace: one(workspaces, {
    fields: [worksheets.workspaceId],
    references: [workspaces.id],
  }),
}));

export const fileRelations = relations(files, ({one}) => ({
  workspace: one(workspaces, {
    fields: [files.workspaceId],
    references: [workspaces.id],
  }),
}));
