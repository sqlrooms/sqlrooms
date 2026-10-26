import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createRunLog, migrateRunLog} from './runLog';
import type {RoomCommandResult} from '@sqlrooms/room-store';

/** Durable acknowledgement of a content command. */
export type CommitReceipt = {
  operationId: string;
  revision: number;
  artifactId: string;
  result: RoomCommandResult;
};

/** One metadata transaction, including its recovery receipt and audit event. */
export type MetadataCommit = {
  receipt: CommitReceipt;
  requestHash: string;
  update: Uint8Array;
  commandId: string;
  principalId: string;
};

/** The host is the only writer; callers await commit before publishing. */
export type MetadataStore = ReturnType<typeof openMetadata>;

/** Open versioned, local operational storage. DuckDB never attaches this file. */
export function openMetadata(path: string) {
  const db = new DatabaseSync(path);
  let failed: unknown;
  const assertHealthy = () => {
    if (failed)
      throw new Error('Metadata connection requires recovery.', {
        cause: failed,
      });
  };
  try {
    db.exec(
      'PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON',
    );
    const version = Number(
      db.prepare('PRAGMA user_version').get()!.user_version,
    );
    if (version > 4)
      throw new Error(`Unsupported Roomie metadata version ${version}`);
    if (version === 0)
      db.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE commits (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        operation_id TEXT NOT NULL UNIQUE,
        request_hash TEXT NOT NULL,
        artifact_id TEXT NOT NULL,
        revision INTEGER NOT NULL,
        receipt TEXT NOT NULL,
        loro_update BLOB NOT NULL
      );
      CREATE TABLE revisions (artifact_id TEXT PRIMARY KEY, revision INTEGER NOT NULL);
      CREATE TABLE events (
        sequence INTEGER PRIMARY KEY REFERENCES commits(sequence),
        user_id TEXT NOT NULL, command_id TEXT NOT NULL, payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      PRAGMA user_version=1;
      COMMIT;
    `);
    if (version < 2) migrateRunLog(db);
    if (version < 3) {
      db.exec(
        'BEGIN IMMEDIATE; CREATE TABLE workspace_identity (id TEXT NOT NULL);',
      );
      db.prepare('INSERT INTO workspace_identity VALUES (?)').run(randomUUID());
      db.exec('PRAGMA user_version=3; COMMIT;');
    }
    if (version < 4)
      db.exec(
        'BEGIN IMMEDIATE; CREATE TABLE data_effects(operation_id TEXT PRIMARY KEY, request_hash TEXT NOT NULL, status TEXT NOT NULL); PRAGMA user_version=4; COMMIT;',
      );
  } catch (error) {
    db.close();
    throw error;
  }

  const receiptFrom = (
    connection: DatabaseSync,
    operationId: string,
    requestHash: string,
  ) => {
    assertHealthy();
    const row = connection
      .prepare('SELECT request_hash, receipt FROM commits WHERE operation_id=?')
      .get(operationId);
    if (!row) return undefined;
    if (row.request_hash !== requestHash)
      throw new Error('Operation ID was already used with different input.');
    return JSON.parse(String(row.receipt)) as CommitReceipt;
  };

  const runs = createRunLog(db, assertHealthy, (error) => {
    failed = error;
  });
  return {
    runs,
    workspaceId: String(
      db.prepare('SELECT id FROM workspace_identity').get()!.id,
    ),
    /** Initial import is an offline operation, admitted only into empty metadata. */
    initializeContent(update: Uint8Array, artifactIds: string[]) {
      assertHealthy();
      if (db.prepare('SELECT 1 FROM commits LIMIT 1').get())
        throw new Error('Metadata already contains content.');
      db.exec('BEGIN IMMEDIATE');
      try {
        const receipt = {
          operationId: 'legacy-import',
          artifactId: 'workspace',
          revision: 1,
          result: {
            success: true,
            commandId: 'workspace.import',
            data: {artifactIds},
          },
        };
        db.prepare(
          'INSERT INTO commits(operation_id,request_hash,artifact_id,revision,receipt,loro_update) VALUES (?,?,?,?,?,?)',
        ).run(
          'legacy-import',
          'legacy-import',
          'workspace',
          1,
          JSON.stringify(receipt),
          update,
        );
        for (const id of artifactIds)
          db.prepare('INSERT INTO revisions VALUES (?,1)').run(id);
        db.exec('COMMIT');
      } catch (error) {
        if (db.isTransaction) db.exec('ROLLBACK');
        throw error;
      }
    },
    dataEffects: {
      begin(operationId: string, requestHash: string) {
        assertHealthy();
        const existing = db
          .prepare('SELECT request_hash FROM data_effects WHERE operation_id=?')
          .get(operationId);
        if (existing && existing.request_hash !== requestHash)
          throw new Error(
            'Operation ID was already used with different input.',
          );
        db.prepare(
          "INSERT INTO data_effects VALUES (?, ?, 'pending') ON CONFLICT(operation_id) DO UPDATE SET status='pending'",
        ).run(operationId, requestHash);
      },
      finish(operationId: string, status: 'committed' | 'interrupted') {
        assertHealthy();
        db.prepare('UPDATE data_effects SET status=? WHERE operation_id=?').run(
          status,
          operationId,
        );
      },
      pending() {
        return db
          .prepare(
            "SELECT operation_id, request_hash FROM data_effects WHERE status='pending'",
          )
          .all()
          .map((row) => ({
            operationId: String(row.operation_id),
            requestHash: String(row.request_hash),
          }));
      },
    },
    receipt: (operationId: string, requestHash: string) =>
      receiptFrom(db, operationId, requestHash),
    /** A fresh connection cannot see a writer's uncommitted transaction. */
    resolveReceipt(operationId: string, requestHash: string) {
      const reader = new DatabaseSync(path, {readOnly: true});
      try {
        return receiptFrom(reader, operationId, requestHash);
      } finally {
        reader.close();
      }
    },
    revision(artifactId: string) {
      assertHealthy();
      return Number(
        db
          .prepare('SELECT revision FROM revisions WHERE artifact_id=?')
          .get(artifactId)?.revision ?? 0,
      );
    },
    /** Monotonic sequence for ordering content snapshots across transports. */
    sequence() {
      assertHealthy();
      return Number(
        db
          .prepare('SELECT coalesce(max(sequence),0) AS sequence FROM commits')
          .get()!.sequence,
      );
    },
    load() {
      assertHealthy();
      return db
        .prepare('SELECT loro_update FROM commits ORDER BY sequence')
        .all()
        .map((row) => new Uint8Array(row.loro_update as Uint8Array));
    },
    events(after = 0, limit = 100) {
      assertHealthy();
      return db
        .prepare(
          'SELECT * FROM events WHERE sequence > ? ORDER BY sequence LIMIT ?',
        )
        .all(after, limit);
    },
    async commit({
      receipt,
      requestHash,
      update,
      commandId,
      principalId,
    }: MetadataCommit) {
      assertHealthy();
      db.exec('BEGIN IMMEDIATE');
      try {
        const {lastInsertRowid} = db
          .prepare(
            `INSERT INTO commits
          (operation_id, request_hash, artifact_id, revision, receipt, loro_update)
          VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(
            receipt.operationId,
            requestHash,
            receipt.artifactId,
            receipt.revision,
            JSON.stringify(receipt),
            update,
          );
        db.prepare(
          `INSERT INTO revisions VALUES (?, ?)
          ON CONFLICT(artifact_id) DO UPDATE SET revision=excluded.revision`,
        ).run(receipt.artifactId, receipt.revision);
        db.prepare(
          'INSERT INTO events(sequence, user_id, command_id, payload) VALUES (?, ?, ?, ?)',
        ).run(lastInsertRowid, principalId, commandId, JSON.stringify(receipt));
        db.exec('COMMIT');
      } catch (error) {
        // An exception is not evidence of rollback. The host resolves the receipt.
        if (db.isTransaction) {
          try {
            db.exec('ROLLBACK');
          } catch (rollbackError) {
            failed = rollbackError;
          }
        }
        throw error;
      }
    },
    /** SQLite's own snapshot operation includes committed WAL contents. */
    snapshot(destination: string, includeHistory: boolean) {
      assertHealthy();
      db.prepare('VACUUM INTO ?').run(destination);
      if (!includeHistory) {
        const copy = new DatabaseSync(destination);
        try {
          copy.exec(
            'PRAGMA foreign_keys=ON; BEGIN IMMEDIATE; DELETE FROM approvals; DELETE FROM run_events; DELETE FROM runs; DELETE FROM conversations; DELETE FROM run_blobs; COMMIT; VACUUM;',
          );
        } finally {
          copy.close();
        }
      }
    },
    close() {
      db.close();
    },
  };
}
