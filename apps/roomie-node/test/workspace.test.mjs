import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {test} from 'node:test';
import {LoroDoc} from 'loro-crdt';
import {openWorkspace, openMetadata} from '../dist/index.mjs';

const create = (operationId = 'create') => ({
  commandId: 'block-document.create',
  operationId,
  principalId: 'owner',
  input: {
    title: 'A durable document',
    blocks: [{id: 'intro', type: 'paragraph', text: 'From Node'}],
  },
});
const rename = (receipt, operationId = 'rename', title = 'Renamed') => ({
  commandId: 'block-document.rename',
  operationId,
  principalId: 'owner',
  artifactId: receipt.artifactId,
  expectedRevision: receipt.revision,
  input: {artifactId: receipt.artifactId, title},
});
async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'roomie-node-test-'));
  const host = await openWorkspace({directory, ...options});
  t.after(async () => {
    await host.dispose();
    await rm(directory, {recursive: true, force: true});
  });
  return {host, directory};
}
function version(snapshot) {
  const doc = new LoroDoc();
  try {
    doc.import(snapshot);
    return doc.oplogVersion().toJSON();
  } finally {
    doc.free();
  }
}

test('real commands persist and reopen with revisions, stable receipt IDs and no view state', async (t) => {
  const {host, directory} = await fixture(t);
  assert.equal(host.engine, 'v2.0.0');
  assert.equal(host.quack, 'disabled');
  const receipt = await host.mutate(create());
  assert.equal(receipt.revision, 1);
  const snapshot = await host.snapshot();
  assert.equal(
    snapshot.content.artifacts.artifactsById[receipt.artifactId].title,
    'A durable document',
  );
  assert.equal('currentArtifactId' in snapshot.content.artifacts, false);
  assert.equal('tableExplorers' in snapshot.content, false);
  const read = await host.read('block-document.get', {
    artifactId: receipt.artifactId,
  });
  assert.equal(read.data.blocks[0].id, 'intro');
  await assert.rejects(host.read('block-document.get'), /explicit artifactId/);
  assert.deepEqual(await host.mutate(create()), receipt);
  await assert.rejects(
    host.mutate({...create(), input: {title: 'different'}}),
    /different input/,
  );
  await assert.rejects(openWorkspace({directory}), /active host/);
  const changed = await host.mutate(rename(receipt));
  assert.equal(changed.revision, 2);
  await host.dispose();
  const reopened = await openWorkspace({directory});
  try {
    assert.deepEqual(await reopened.mutate(create()), receipt);
    assert.equal(
      (await reopened.snapshot()).content.artifacts.artifactsById[
        receipt.artifactId
      ].title,
      'Renamed',
    );
    assert.equal((await reopened.events()).length, 2);
    const db = new DatabaseSync(join(directory, 'meta.sqlite'));
    try {
      assert.equal(db.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
      assert.equal(
        db.prepare('SELECT user_id FROM events LIMIT 1').get().user_id,
        'owner',
      );
    } finally {
      db.close();
    }
  } finally {
    await reopened.dispose();
  }
});

test('concurrent stale edits produce one commit and one structured conflict', async (t) => {
  const {host} = await fixture(t);
  const receipt = await host.mutate(create());
  const results = await Promise.all([
    host.mutate(rename(receipt, 'a', 'A')),
    host.mutate(rename(receipt, 'b', 'B')),
  ]);
  assert.equal(results.filter((r) => r.revision === 2).length, 1);
  const conflict = results.find((r) => r.code === 'revision-conflict');
  assert.equal(conflict.currentRevision, 2);
  assert.equal((await host.events()).length, 2);
  await assert.rejects(
    host.mutate({...rename(receipt), expectedRevision: undefined}),
    /expectedRevision/,
  );
  await assert.rejects(
    host.mutate({...rename(receipt), input: {title: 'implicit'}}),
    /explicit matching/,
  );
});

test('nested rich-text attributes are cloned before mirror annotation and survive recovery', async (t) => {
  const {host, directory} = await fixture(t);
  const request = create();
  request.input.blocks[0].text = [
    {
      type: 'text',
      text: 'a',
      marks: [
        {type: 'link', attrs: {href: 'https://example.com', nested: {x: 1}}},
      ],
    },
  ];
  const receipt = await host.mutate(request);
  const snapshot = await host.snapshot();
  const body =
    snapshot.content.blockDocuments.artifacts[receipt.artifactId].content;
  assert.equal(JSON.stringify(body).includes('$cid'), false);
  body.content[0].content[0].marks[0].attrs.nested.x = 9;
  const read = await host.read('block-document.get', {
    artifactId: receipt.artifactId,
  });
  assert.equal(read.data.blocks[0].text[0].marks[0].attrs.nested.x, 1);
  await host.dispose();
  const reopened = await openWorkspace({directory});
  try {
    const result = await reopened.read('block-document.get', {
      artifactId: receipt.artifactId,
    });
    assert.deepEqual(result.data.blocks[0].text, request.input.blocks[0].text);
  } finally {
    await reopened.dispose();
  }
});

test('failed commit rebuilds Loro history, mirrors and projection before reads resume', async (t) => {
  let fail = false;
  const {host} = await fixture(t, {
    openMetadata: (path) => {
      const db = openMetadata(path);
      return {
        ...db,
        commit: async (value) => {
          if (fail) throw new Error('disk full before commit');
          await db.commit(value);
        },
      };
    },
  });
  const receipt = await host.mutate(create());
  const before = await host.snapshot();
  const published = [];
  host.subscribe((r) => published.push(r));
  fail = true;
  await assert.rejects(
    host.mutate(rename(receipt, 'rejected', 'MUST NOT SURVIVE')),
    /disk full/,
  );
  const restored = await host.snapshot();
  assert.deepEqual(restored.content, before.content);
  assert.deepEqual(version(restored.loro), version(before.loro));
  assert.equal(published.length, 0);
  assert.equal((await host.events()).length, 1);
  fail = false;
  const next = await host.mutate(rename(receipt, 'accepted', 'Survives'));
  assert.equal(next.revision, 2);
  assert.equal(published.length, 1);
});

test('SQLite failure after inserting content and receipt rolls the entire transaction back', async (t) => {
  const {host, directory} = await fixture(t);
  const receipt = await host.mutate(create());
  const db = new DatabaseSync(join(directory, 'meta.sqlite'));
  try {
    db.exec(
      "CREATE TRIGGER reject_event BEFORE INSERT ON events BEGIN SELECT RAISE(ABORT, 'event write failed'); END",
    );
    await assert.rejects(host.mutate(rename(receipt)), /event write failed/);
    assert.equal(
      db.prepare('SELECT count(*) AS count FROM commits').get().count,
      1,
    );
    assert.equal(
      db.prepare('SELECT revision FROM revisions').get().revision,
      1,
    );
    assert.equal((await host.events()).length, 1);
    assert.equal(
      (await host.read('block-document.get', {artifactId: receipt.artifactId}))
        .data.title,
      'A durable document',
    );
    db.exec('DROP TRIGGER reject_event');
    assert.equal((await host.mutate(rename(receipt))).revision, 2);
  } finally {
    db.close();
  }
});

test('the native owner lock rejects another process before it can open metadata', async (t) => {
  const {directory} = await fixture(t);
  const script = `import {openWorkspace} from ${JSON.stringify(new URL('../dist/index.mjs', import.meta.url).href)}; try { const host = await openWorkspace({directory: process.argv[1]}); await host.dispose(); process.exit(1); } catch (error) { if (!/lock|conflicting/i.test(String(error))) { console.error(error); process.exit(2); } }`;
  const child = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', script, directory],
    {encoding: 'utf8', timeout: 30000},
  );
  assert.equal(child.status, 0, child.stderr);
});

test('tentative content cannot escape through snapshots, commands, events or subscribers', async (t) => {
  let pause = false,
    release,
    entered;
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  const {host} = await fixture(t, {
    openMetadata: (path) => {
      const db = openMetadata(path);
      return {
        ...db,
        commit: async (value) => {
          if (pause) {
            entered();
            await blocked;
          }
          await db.commit(value);
        },
      };
    },
  });
  const receipt = await host.mutate(create());
  const publications = [];
  host.subscribe((r) => publications.push(r));
  pause = true;
  const mutation = host.mutate(rename(receipt));
  await started;
  let readsFinished = 0;
  const reads = Promise.all([
    host.snapshot(),
    host.read('block-document.get', {artifactId: receipt.artifactId}),
    host.events(),
  ]).then((values) => {
    readsFinished++;
    return values;
  });
  await delay(25);
  assert.equal(readsFinished, 0);
  assert.equal(publications.length, 0);
  release();
  await mutation;
  const [snapshot, read, events] = await reads;
  assert.equal(
    snapshot.content.artifacts.artifactsById[receipt.artifactId].title,
    'Renamed',
  );
  assert.equal(read.data.title, 'Renamed');
  assert.equal(events.length, 2);
  assert.equal(publications.length, 1);
});

test('uncertain commit response resolves the durable receipt and duplicate requests commit once', async (t) => {
  let loseResponse = true;
  const {host} = await fixture(t, {
    openMetadata: (path) => {
      const db = openMetadata(path);
      return {
        ...db,
        commit: async (value) => {
          await db.commit(value);
          if (loseResponse) {
            loseResponse = false;
            throw new Error('commit response lost');
          }
        },
      };
    },
  });
  const results = await Promise.all([
    host.mutate(create()),
    host.mutate(create()),
  ]);
  assert.deepEqual(results[0], results[1]);
  assert.equal((await host.events()).length, 1);
  assert.equal((await host.snapshot()).revisions[results[0].artifactId], 1);
  host.subscribe(() => {
    throw new Error('disconnected subscriber');
  });
  assert.equal((await host.mutate(rename(results[0]))).revision, 2);
});

test('unreadable recovery receipt fails closed until restart', async (t) => {
  const {host} = await fixture(t, {
    openMetadata: (path) => {
      const db = openMetadata(path);
      return {
        ...db,
        commit: async () => {
          throw new Error('I/O failure');
        },
        resolveReceipt: () => {
          throw new Error('cannot read storage');
        },
      };
    },
  });
  await assert.rejects(host.mutate(create()), /failed closed/);
  await assert.rejects(host.snapshot(), /failed closed/);
  await assert.rejects(host.read('block-document.list'), /failed closed/);
  await assert.rejects(host.mutate(create('another')), /failed closed/);
});

test('slow preparation allows committed reads; dispose drains an accepted preparation', async (t) => {
  let release, entered;
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  const {host, directory} = await fixture(t, {
    prepareCommand: async () => {
      entered();
      await blocked;
    },
  });
  const pending = host.mutate(create());
  await started;
  assert.equal(
    Object.keys((await host.snapshot()).content.blockDocuments.artifacts)
      .length,
    0,
  );
  assert.equal((await host.read('block-document.list')).success, true);
  let flushed = false,
    disposed = false;
  const flushing = host.flush().then(
    () => {
      flushed = true;
    },
    () => {},
  );
  const disposal = host.dispose().then(() => {
    disposed = true;
  });
  await delay(25);
  assert.equal(flushed, false);
  assert.equal(disposed, false);
  release();
  const receipt = await pending;
  await Promise.all([flushing, disposal]);
  const reopened = await openWorkspace({directory});
  try {
    assert.equal((await reopened.snapshot()).revisions[receipt.artifactId], 1);
  } finally {
    await reopened.dispose();
  }
});

for (const boundary of ['before', 'after']) {
  test(`process crash ${boundary} SQLite commit is recovered without trusting publication`, async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'roomie-node-crash-'));
    t.after(() => rm(directory, {recursive: true, force: true}));
    const child = spawnSync(
      process.execPath,
      [
        new URL('./crash-child.mjs', import.meta.url).pathname,
        directory,
        boundary,
      ],
      {encoding: 'utf8', timeout: 30000},
    );
    assert.equal(child.status, 73, child.stderr);
    const host = await openWorkspace({directory});
    try {
      assert.equal((await host.events()).length, boundary === 'after' ? 1 : 0);
      const recovered = await host.mutate(create());
      assert.equal(recovered.revision, 1);
      assert.equal((await host.events()).length, 1);
    } finally {
      await host.dispose();
    }
  });
}
