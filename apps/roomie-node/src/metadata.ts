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
    if (version > 2)
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
    close() {
      db.close();
    },
  };
}
