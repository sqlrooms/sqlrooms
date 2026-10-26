import {DuckDBInstance} from '@duckdb/node-api';
import {copyFile, mkdir, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {LoroDoc} from 'loro-crdt';
import {parseContentWorkspace} from '../../roomie-cli-ui/src/contentPersistence';
import {z} from 'zod';
import {RoomieContent} from '../../roomie-cli-ui/src/stateOwnership';
import {parseStoredContent} from './content';
import {openWorkspace} from './workspace';

/**
 * Migrate an offline legacy Roomie DuckDB into a new directory. The source is
 * opened read-only and retained as the backup; existing destinations are refused.
 * When both stores exist the caller explicitly chooses the authoritative one.
 */
export async function migrateLegacyWorkspace(options: {
  source: string;
  destination: string;
  contentSource?: 'envelope' | 'snapshot';
  roomId?: string;
}) {
  const instance = await DuckDBInstance.create(options.source, {
    access_mode: 'READ_ONLY',
  });
  const connection = await instance.connect();
  let created = false;
  try {
    const tables = (
      await connection.runAndReadAll(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='__roomie' AND table_name IN ('ui_state','sync_rooms')",
      )
    )
      .getRowObjectsJson()
      .map((row) => row.table_name);
    let envelope: unknown;
    if (tables.includes('ui_state')) {
      const row = (
        await connection.runAndReadAll(
          "SELECT payload_json FROM __roomie.ui_state WHERE key='default'",
        )
      ).getRowObjectsJson()[0];
      if (row) {
        const value =
          typeof row.payload_json === 'string'
            ? JSON.parse(row.payload_json)
            : row.payload_json;
        envelope = value?.state ?? value;
      }
    }
    let snapshot: Uint8Array | undefined;
    if (tables.includes('sync_rooms')) {
      const row = (
        await connection.runAndReadAll(
          'SELECT snapshot FROM __roomie.sync_rooms WHERE room_id=$1',
          [options.roomId ?? 'workspace'],
        )
      ).getRows()[0];
      const blob = row?.[0];
      if (blob && typeof blob === 'object' && 'bytes' in blob)
        snapshot = blob.bytes as Uint8Array;
    }
    if (envelope && snapshot && !options.contentSource)
      throw new Error(
        'Both legacy stores contain content; select envelope or snapshot explicitly.',
      );
    const source =
      options.contentSource ?? (envelope ? 'envelope' : 'snapshot');
    let content: RoomieContent;
    if (source === 'envelope') content = parseContentWorkspace(envelope);
    else {
      if (!snapshot)
        throw new Error('No legacy snapshot for the selected room.');
      const doc = new LoroDoc();
      try {
        const imported = doc.import(snapshot);
        if (imported.pending?.size)
          throw new Error('Incomplete legacy snapshot.');
        // Roomie's content mirror is versioned by the validated content schema.
        // Other applications' mirrors must be migrated by their own importer.
        content = parseContentWorkspace({
          application: 'roomie',
          schemaVersion: 2,
          ...snapshotContent(doc.toJSON()),
        });
      } finally {
        doc.free();
      }
    }
    const sourceCatalog = String(
      (
        await connection.runAndReadAll('SELECT current_database() AS name')
      ).getRowObjectsJson()[0]!.name,
    );
    // Parse identifiers with DuckDB to preserve dots inside quoted names.
    async function rebind(name: string) {
      const parsed = JSON.parse(
        String(
          (
            await connection.runAndReadAll(
              'SELECT json_serialize_sql($1) AS ast',
              ['SELECT * FROM ' + name],
            )
          ).getRowObjectsJson()[0]!.ast,
        ),
      );
      const table = parsed.statements?.[0]?.node?.from_table;
      if (
        parsed.error ||
        parsed.statements.length !== 1 ||
        table?.type !== 'BASE_TABLE'
      )
        throw new Error('Invalid legacy source name.');
      if (table.catalog_name && table.catalog_name !== sourceCatalog)
        throw new Error('Legacy source references another database.');
      const schema = table.schema_name || 'main';
      const exists = (
        await connection.runAndReadAll(
          'SELECT 1 FROM duckdb_tables() WHERE database_name=$1 AND schema_name=$2 AND table_name=$3',
          [sourceCatalog, schema, table.table_name],
        )
      ).getRows().length;
      if (
        !exists ||
        schema.startsWith('__') ||
        table.table_name.startsWith('__')
      )
        throw new Error(
          'Legacy source must be an existing physical user table.',
        );
      const quote = (value: string) => '"' + value.replace(/"/g, '""') + '"';
      return ['data', schema, table.table_name].map(quote).join('.');
    }
    async function bindings(value: unknown): Promise<void> {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        if (
          ['tableName', 'selectedTable', 'lastSelectedTable'].includes(key) &&
          typeof child === 'string'
        )
          (value as Record<string, unknown>)[key] = await rebind(child);
        else if (key === 'sqlQuery' && typeof child === 'string' && child)
          throw new Error(
            'Legacy dashboard SQL sources must be materialized before migration.',
          );
        else await bindings(child);
      }
    }
    await bindings(content.blockDocuments);
    await bindings(content.mosaicDashboard);
    if (
      sourceCatalog !== 'data' &&
      Object.keys(content.htmlApps.appsById).length
    )
      throw new Error(
        'Legacy HTML apps contain executable source: migrate their qualified SQL references explicitly before importing from a renamed catalog.',
      );
    await mkdir(options.destination);
    created = true;
    await copyFile(options.source, join(options.destination, 'data.duckdb'));
    // Offline WAL, when present, is part of the source's durable state.
    await copyFile(
      options.source + '.wal',
      join(options.destination, 'data.duckdb.wal'),
    ).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
    const workspace = await openWorkspace({
      directory: options.destination,
      initialContent: content,
    });
    try {
      return {
        workspaceId: workspace.workspaceId,
        artifacts: Object.keys(content.artifacts.artifactsById).length,
        source,
      };
    } finally {
      await workspace.dispose();
    }
  } catch (error) {
    if (created) await rm(options.destination, {recursive: true, force: true});
    throw error;
  } finally {
    connection.closeSync();
    instance.closeSync();
  }
}

/** Decode known snapshots; unsupported document kinds fail instead of losing content. */
function snapshotContent(value: Record<string, unknown>): RoomieContent {
  if (!value.documents) return parseStoredContent(value);
  const legacy = z
    .object({
      artifacts: z.array(
        z.object({
          id: z.string(),
          type: z.literal('block-document'),
          title: z.string(),
        }),
      ),
      artifactOrder: z.array(z.string()),
      markdownDocuments: z.array(z.unknown()).max(0),
      blockDocuments: z.array(
        z.object({
          id: z.string(),
          content: z.object({
            type: z.literal('prosemirror-json'),
            body: z.unknown(),
          }),
          assets: z.array(z.object({id: z.string()}).passthrough()),
          updatedAt: z.number(),
        }),
      ),
    })
    .parse(value.documents);
  for (const entries of [legacy.artifacts, legacy.blockDocuments])
    if (new Set(entries.map((v) => v.id)).size !== entries.length)
      throw new Error('Duplicate legacy IDs.');
  return RoomieContent.parse({
    artifacts: {
      artifactsById: Object.fromEntries(legacy.artifacts.map((v) => [v.id, v])),
      artifactOrder: legacy.artifactOrder,
    },
    blockDocuments: {
      artifacts: Object.fromEntries(
        legacy.blockDocuments.map((v) => [
          v.id,
          {
            id: v.id,
            content: v.content.body,
            assets: Object.fromEntries(v.assets.map((a) => [a.id, a])),
            updatedAt: v.updatedAt,
          },
        ]),
      ),
    },
    mosaicDashboard: value.mosaicDashboard ?? {},
    htmlApps: value.htmlApps ?? {},
  });
}
