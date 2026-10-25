import {createHash, randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {
  HarnessRunEvent,
  HarnessRun,
  HarnessApproval,
  HarnessStartTurn,
  type HarnessCapabilities,
  type HarnessRunStatus,
} from '@sqlrooms/ai-config';

/** A run protocol error safe to return to authenticated clients. */
export function runError(code: string, status = 409) {
  return Object.assign(new Error(code), {code, status});
}
const activeStates = new Set([
  'queued',
  'running',
  'awaiting-input',
  'awaiting-approval',
]);
/** Migrate the run log on the same writer connection as content commits. */
export function migrateRunLog(db: DatabaseSync) {
  db.exec(`BEGIN IMMEDIATE;
    CREATE TABLE conversations (id TEXT PRIMARY KEY, created_at TEXT NOT NULL);
    CREATE TABLE runs (
      id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id),
      request_key TEXT NOT NULL UNIQUE, request_hash TEXT NOT NULL, record TEXT NOT NULL
    );
    CREATE TABLE run_events (
      seq INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT NOT NULL UNIQUE,
      conversation_id TEXT NOT NULL REFERENCES conversations(id), run_id TEXT NOT NULL REFERENCES runs(id),
      record TEXT NOT NULL
    );
    CREATE INDEX run_events_conversation ON run_events(conversation_id, seq);
    CREATE TABLE approvals (id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id), record TEXT NOT NULL);
    CREATE TABLE run_blobs (id TEXT PRIMARY KEY, content TEXT NOT NULL);
    PRAGMA user_version=2;
    COMMIT;`);
}

/** Synchronous transactions cannot interleave with the content writer. Publish only after COMMIT. */
export function createRunLog(
  db: DatabaseSync,
  assertHealthy: () => void,
  fail: (error: unknown) => void,
) {
  const listeners = new Set<() => void>();
  let secrets: string[] = [];
  const scrub = (value: string) =>
    secrets.reduce(
      (text, secret) => text.split(secret).join('[REDACTED]'),
      value,
    );
  function transaction<T>(work: () => T): T {
    assertHealthy();
    db.exec('BEGIN IMMEDIATE');
    let result: T;
    try {
      result = work();
      db.exec('COMMIT');
    } catch (error) {
      if (db.isTransaction) {
        try {
          db.exec('ROLLBACK');
        } catch (rollbackError) {
          fail(rollbackError);
        }
      } else fail(error);
      throw error;
    }
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        /* Replay repairs failed delivery. */
      }
    }
    return result;
  }
  function get(runId: string): HarnessRun {
    assertHealthy();
    const row = db.prepare('SELECT record FROM runs WHERE id=?').get(runId);
    if (!row) throw runError('run_not_found', 404);
    return HarnessRun.parse(JSON.parse(String(row.record)));
  }
  function save(run: HarnessRun) {
    db.prepare('UPDATE runs SET record=? WHERE id=?').run(
      JSON.stringify(HarnessRun.parse(run)),
      run.runId,
    );
  }
  function append(
    run: HarnessRun,
    kind: string,
    payload: Record<string, unknown>,
    nativeEventId?: string,
  ) {
    const serialized = scrub(JSON.stringify(payload));
    if (Buffer.byteLength(serialized) > 1024 * 1024)
      throw runError('event_too_large', 413);
    let blobRef: string | undefined;
    let inline = JSON.parse(serialized);
    if (Buffer.byteLength(serialized) > 16384) {
      blobRef = randomUUID();
      db.prepare('INSERT INTO run_blobs VALUES (?, ?)').run(
        blobRef,
        serialized,
      );
      inline = Object.fromEntries(
        Object.entries(inline).map(([key, value]) => [
          key,
          typeof value === 'string'
            ? value.slice(0, 4000)
            : ['input', 'result', 'native'].includes(key) &&
                value &&
                typeof value === 'object'
              ? {summary: JSON.stringify(value).slice(0, 1000)}
              : value,
        ]),
      );
    }
    const event = HarnessRunEvent.parse({
      schemaVersion: 1,
      seq: 1,
      eventId: randomUUID(),
      conversationId: run.conversationId,
      runId: run.runId,
      turnId: run.turnId,
      at: new Date().toISOString(),
      principalId: run.principalId,
      kind,
      payload: inline,
      nativeEventId,
      blobRef,
    });
    const row = db
      .prepare(
        'INSERT INTO run_events(event_id, conversation_id, run_id, record) VALUES (?, ?, ?, ?)',
      )
      .run(event.eventId, run.conversationId, run.runId, JSON.stringify(event));
    event.seq = Number(row.lastInsertRowid);
    db.prepare('UPDATE run_events SET record=? WHERE seq=?').run(
      JSON.stringify(event),
      event.seq,
    );
    return event;
  }
  function listRuns() {
    assertHealthy();
    return db
      .prepare('SELECT record FROM runs ORDER BY rowid')
      .all()
      .map((row) => HarnessRun.parse(JSON.parse(String(row.record))));
  }
  function status(run: HarnessRun, value: HarnessRunStatus, reason: string) {
    run.status = value;
    save(run);
    append(run, 'run.status', {status: value, reason, run});
  }
  function approval(id: string) {
    const row = db.prepare('SELECT record FROM approvals WHERE id=?').get(id);
    if (!row) throw runError('approval_not_found', 404);
    return HarnessApproval.parse(JSON.parse(String(row.record)));
  }
  function saveApproval(value: HarnessApproval) {
    db.prepare(
      'INSERT INTO approvals VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET record=excluded.record',
    ).run(value.approvalId, value.runId, JSON.stringify(value));
  }
  function pending(runId?: string) {
    assertHealthy();
    return db
      .prepare('SELECT record FROM approvals')
      .all()
      .map((row) => HarnessApproval.parse(JSON.parse(String(row.record))))
      .filter(
        (value) => value.decision === null && (!runId || value.runId === runId),
      );
  }
  function finish(
    runId: string,
    outcome: 'succeeded' | 'failed' | 'cancelled' | 'interrupted',
    reason: string,
  ) {
    return transaction(() => {
      const run = get(runId);
      if (!activeStates.has(run.status)) return run;
      for (const value of pending(runId)) {
        value.decision = 'deny';
        value.resolvedBy = 'host';
        saveApproval(value);
        append(run, 'approval.resolved', {
          ...value,
          reason: 'Run ended; native approval is no longer live.',
        });
      }
      append(run, 'turn.completed', {outcome, reason});
      status(run, outcome, reason);
      return run;
    });
  }
  function events(after: number, limit = 500, conversationId?: string) {
    assertHealthy();
    if (
      !Number.isSafeInteger(after) ||
      after < 0 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 1000
    )
      throw runError('invalid_cursor', 400);
    return db
      .prepare(
        'SELECT record FROM run_events WHERE seq > ? AND (? IS NULL OR conversation_id=?) ORDER BY seq LIMIT ?',
      )
      .all(after, conversationId ?? null, conversationId ?? null, limit)
      .map((row) => HarnessRunEvent.parse(JSON.parse(String(row.record))));
  }
  return {
    get,
    events,
    pending,
    finish,
    setSecrets(values: string[]) {
      secrets = values.filter(Boolean);
    },
    active: () => listRuns().find((run) => activeStates.has(run.status)),
    start(
      raw: HarnessStartTurn,
      principalId: string,
      capabilities: HarnessCapabilities,
      skillHash: string,
      deadlineMs: number,
    ) {
      const input = HarnessStartTurn.parse(raw);
      const hash = createHash('sha256')
        .update(JSON.stringify({input, principalId}))
        .digest('hex');
      return transaction(() => {
        const prior = db
          .prepare('SELECT id, request_hash FROM runs WHERE request_key=?')
          .get(input.idempotencyKey);
        if (prior) {
          if (prior.request_hash !== hash)
            throw runError('idempotency_conflict');
          return {run: get(String(prior.id)), created: false};
        }
        if (listRuns().some((run) => activeStates.has(run.status)))
          throw runError('workspace_run_active');
        const conversationId = input.conversationId ?? randomUUID();
        if (
          input.conversationId &&
          !db
            .prepare('SELECT id FROM conversations WHERE id=?')
            .get(conversationId)
        )
          throw runError('conversation_not_found', 404);
        db.prepare('INSERT OR IGNORE INTO conversations VALUES (?, ?)').run(
          conversationId,
          new Date().toISOString(),
        );
        const run: HarnessRun = {
          runId: randomUUID(),
          conversationId,
          turnId: randomUUID(),
          principalId,
          status: 'queued',
          capabilities,
          nativeSessionId: null,
          deadlineAt: new Date(Date.now() + deadlineMs).toISOString(),
          skillHash,
        };
        db.prepare('INSERT INTO runs VALUES (?, ?, ?, ?, ?)').run(
          run.runId,
          conversationId,
          input.idempotencyKey,
          hash,
          JSON.stringify(run),
        );
        append(run, 'run.status', {status: 'queued', run});
        append(run, 'turn.started', {
          origin: input.conversationId ? 'continuation' : 'user',
          nativeContextResumed: false,
        });
        append(run, 'message.user', {
          text: input.text,
          attachments: input.attachments,
        });
        return {run, created: true};
      });
    },
    started(runId: string, nativeSessionId: string) {
      return transaction(() => {
        const run = get(runId);
        if (!activeStates.has(run.status)) throw runError('run_not_active');
        run.nativeSessionId = nativeSessionId;
        status(run, 'running', 'Harness started.');
      });
    },
    append(
      runId: string,
      kind: string,
      payload: Record<string, unknown>,
      nativeEventId?: string,
    ) {
      return transaction(() => {
        const run = get(runId);
        if (!activeStates.has(run.status)) throw runError('run_not_active');
        return append(run, kind, payload, nativeEventId);
      });
    },
    requestApproval(runId: string, callId: string, summary: string) {
      return transaction(() => {
        const run = get(runId);
        if (!activeStates.has(run.status)) throw runError('run_not_active');
        const value: HarnessApproval = {
          approvalId: randomUUID(),
          runId,
          callId,
          summary: scrub(summary).slice(0, 8000),
          options: ['approve', 'deny'],
          decision: null,
          resolvedBy: null,
        };
        saveApproval(value);
        append(run, 'approval.requested', value);
        status(run, 'awaiting-approval', 'Waiting for owner.');
        return value;
      });
    },
    resolveApproval(
      id: string,
      decision: 'approve' | 'deny',
      principalId: string,
    ) {
      return transaction(() => {
        const value = approval(id);
        const run = get(value.runId);
        if (value.decision !== null) {
          if (value.decision === decision && value.resolvedBy === principalId)
            return {approval: value, changed: false};
          throw runError('approval_conflict');
        }
        if (!activeStates.has(run.status)) throw runError('approval_stale');
        value.decision = decision;
        value.resolvedBy = principalId;
        saveApproval(value);
        append(run, 'approval.resolved', value);
        if (!pending(run.runId).length)
          status(run, 'running', 'Owner resolved approval.');
        return {approval: value, changed: true};
      });
    },
    recover() {
      for (const run of listRuns())
        if (activeStates.has(run.status))
          finish(
            run.runId,
            'interrupted',
            'Host restarted; native work was not resumed. Start a new continuation turn.',
          );
    },
    conversations() {
      assertHealthy();
      return db
        .prepare(
          `SELECT c.id, c.created_at,
            (SELECT substr(json_extract(e.record, '$.payload.text'), 1, 100)
             FROM run_events e WHERE e.conversation_id=c.id AND json_extract(e.record, '$.kind')='message.user' ORDER BY e.seq LIMIT 1) AS title,
            (SELECT json_extract(e.record, '$.at') FROM run_events e WHERE e.conversation_id=c.id ORDER BY e.seq DESC LIMIT 1) AS updatedAt,
            (SELECT json_extract(r.record, '$.status') FROM runs r WHERE r.conversation_id=c.id ORDER BY r.rowid DESC LIMIT 1) AS status
           FROM conversations c ORDER BY updatedAt DESC LIMIT 100`,
        )
        .all();
    },
    snapshot(conversationId: string) {
      assertHealthy();
      if (
        !db
          .prepare('SELECT id FROM conversations WHERE id=?')
          .get(conversationId)
      )
        throw runError('conversation_not_found', 404);
      const lastSeq = Number(
        db.prepare('SELECT COALESCE(MAX(seq),0) AS seq FROM run_events').get()!
          .seq,
      );
      // Bounded pages are fetched before subscribing; lastSeq denotes this page's cursor.
      const page = events(0, 1000, conversationId);
      const more =
        page.length === 1000 &&
        events(page.at(-1)!.seq, 1, conversationId).length > 0;
      return {
        conversationId,
        lastSeq,
        historyHasMore: more,
        historyAfterSeq: page.at(-1)?.seq ?? 0,
        events: page,
        runs: listRuns().filter((run) => run.conversationId === conversationId),
        pendingApprovals: pending().filter(
          (value) => get(value.runId).conversationId === conversationId,
        ),
      };
    },
    blob(id: string) {
      assertHealthy();
      const row = db
        .prepare('SELECT content FROM run_blobs WHERE id=?')
        .get(id);
      if (!row) throw runError('blob_not_found', 404);
      return String(row.content);
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
