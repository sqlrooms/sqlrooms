import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {
  open,
  mkdir,
  readdir,
  lstat,
  mkdtemp,
  rm,
  link,
  unlink,
  copyFile,
} from 'node:fs/promises';
import {join, dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {DuckDBInstance} from '@duckdb/node-api';
import {LoroDoc} from 'loro-crdt';
import {parseContentWorkspace} from '../../roomie-cli-ui/src/contentPersistence';
import {parseStoredContent} from './content';
import {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';

const magic = Buffer.from('ROOMIE1\n');
const maxBytes = 2 * 1024 * 1024 * 1024;
const Manifest = z.strictObject({
  format: z.literal('roomie'),
  version: z.literal(1),
  engine: z.literal('v2.0.0'),
  history: z.enum(['included', 'excluded']),
  files: z
    .array(
      z.strictObject({
        path: z.string(),
        size: z.number().int().nonnegative().max(maxBytes),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .max(10000),
});
function validPath(path: string) {
  return (
    (path === 'data.duckdb' ||
      path === 'meta.sqlite' ||
      path.startsWith('assets/')) &&
    path.length <= 1024 &&
    !/[\\\x00:]/.test(path) &&
    !path
      .split('/')
      .some((part) => part === '..' || part === '.' || part === '')
  );
}
async function digest(path: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
async function filesIn(root: string, relative = ''): Promise<string[]> {
  const result: string[] = [];
  for (const name of await readdir(join(root, relative))) {
    const path = relative ? `${relative}/${name}` : name;
    const stat = await lstat(join(root, path));
    if (stat.isSymbolicLink())
      throw new Error('Bundle assets cannot be symbolic links.');
    if (stat.isDirectory()) result.push(...(await filesIn(root, path)));
    else if (stat.isFile()) result.push(path);
    else throw new Error('Unsupported asset type.');
  }
  return result;
}
/** Pack an already-consistent snapshot. Credentials and native sessions are never included. */
export async function writeBundle(
  snapshot: string,
  destination: string,
  includeHistory: boolean,
) {
  const paths = [
    'data.duckdb',
    'meta.sqlite',
    ...(await filesIn(join(snapshot, 'assets')).then((paths) =>
      paths.map((path) => 'assets/' + path),
    )),
  ];
  if (paths.some((path) => !validPath(path)))
    throw new Error('Invalid asset path.');
  const files = await Promise.all(
    paths.map(async (path) => ({
      path,
      size: (await lstat(join(snapshot, path))).size,
      sha256: await digest(join(snapshot, path)),
    })),
  );
  if (files.reduce((sum, file) => sum + file.size, 0) > maxBytes)
    throw new Error('Bundle exceeds 2 GiB.');
  const manifest = Manifest.parse({
    format: 'roomie',
    version: 1,
    engine: 'v2.0.0',
    history: includeHistory ? 'included' : 'excluded',
    files,
  });
  const header = Buffer.from(JSON.stringify(manifest));
  if (header.length > 1024 * 1024)
    throw new Error('Bundle manifest too large.');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(header.length);
  const staging = await mkdtemp(join(dirname(destination), '.roomie-bundle-'));
  const temp = join(staging, 'bundle');
  try {
    const output = await open(temp, 'wx', 0o600);
    try {
      await output.writeFile(magic);
      await output.writeFile(length);
      await output.writeFile(header);
      for (const file of files)
        for await (const chunk of createReadStream(join(snapshot, file.path)))
          await output.writeFile(chunk as Buffer);
      await output.sync();
    } finally {
      await output.close();
    }
    await link(temp, destination); // Atomic publication without replacing an existing bundle.
    await unlink(temp);
    return manifest;
  } finally {
    if (staging) await rm(staging, {recursive: true, force: true});
  }
}
/** Import a validated v1 bundle into a new directory; never modify the source or an existing workspace. */
export async function importWorkspaceBundle(
  source: string,
  destination: string,
) {
  const input = await open(source, 'r');
  let staging = '';
  let created = false;
  try {
    staging = await mkdtemp(join(tmpdir(), 'roomie-import-'));
    const prefix = Buffer.alloc(12);
    if (
      (await input.read(prefix, 0, 12, 0)).bytesRead !== 12 ||
      !prefix.subarray(0, 8).equals(magic)
    )
      throw new Error('Invalid Roomie bundle header.');
    const length = prefix.readUInt32BE(8);
    if (length > 1024 * 1024) throw new Error('Bundle manifest too large.');
    const bytes = Buffer.alloc(length);
    if ((await input.read(bytes, 0, length, 12)).bytesRead !== length)
      throw new Error('Truncated manifest.');
    const manifest = Manifest.parse(JSON.parse(bytes.toString()));
    const paths = new Set<string>();
    let offset = 12 + length;
    for (const file of manifest.files) {
      if (paths.has(file.path) || !validPath(file.path))
        throw new Error('Invalid or duplicate bundle path.');
      paths.add(file.path);
      offset += file.size;
    }
    if (
      !paths.has('data.duckdb') ||
      !paths.has('meta.sqlite') ||
      offset > maxBytes + 1024 * 1024 ||
      offset !== (await input.stat()).size
    )
      throw new Error('Incomplete or oversized bundle.');
    offset = 12 + length;
    for (const file of manifest.files) {
      const path = join(staging, file.path);
      await mkdir(dirname(path), {recursive: true});
      const output = await open(path, 'wx', 0o600);
      const hash = createHash('sha256');
      try {
        let remaining = file.size;
        while (remaining) {
          const buffer = Buffer.alloc(Math.min(1024 * 1024, remaining));
          const read = await input.read(buffer, 0, buffer.length, offset);
          if (!read.bytesRead) throw new Error('Truncated bundle file.');
          const chunk = buffer.subarray(0, read.bytesRead);
          hash.update(chunk);
          await output.writeFile(chunk);
          offset += read.bytesRead;
          remaining -= read.bytesRead;
        }
        await output.sync();
      } finally {
        await output.close();
      }
      if (hash.digest('hex') !== file.sha256)
        throw new Error('Bundle checksum mismatch.');
    }
    const metadata = new DatabaseSync(join(staging, 'meta.sqlite'), {
      readOnly: true,
    });
    try {
      if (
        Number(metadata.prepare('PRAGMA user_version').get()!.user_version) > 4
      )
        throw new Error('Unsupported metadata version.');
      if (metadata.prepare('PRAGMA quick_check').get()!.quick_check !== 'ok')
        throw new Error('Invalid metadata snapshot.');
      const doc = new LoroDoc();
      try {
        for (const row of metadata
          .prepare('SELECT loro_update FROM commits ORDER BY sequence')
          .all()) {
          const imported = doc.import(row.loro_update as Uint8Array);
          if (imported.pending?.size)
            throw new Error('Incomplete content snapshot.');
        }
        // Empty workspaces have no content commits.
        if (metadata.prepare('SELECT 1 FROM commits LIMIT 1').get())
          parseContentWorkspace({
            application: 'roomie',
            schemaVersion: 2,
            ...parseStoredContent(doc.toJSON()),
          });
      } finally {
        doc.free();
      }
      if (
        manifest.history === 'excluded' &&
        Number(metadata.prepare('SELECT count(*) AS n FROM runs').get()!.n) !==
          0
      )
        throw new Error('Bundle history policy mismatch.');
    } finally {
      metadata.close();
    }
    const analytics = await DuckDBInstance.create(
      join(staging, 'data.duckdb'),
      {access_mode: 'READ_ONLY'},
    );
    try {
      const connection = await analytics.connect();
      try {
        await connection.run('SELECT count(*) FROM duckdb_tables()');
      } finally {
        connection.closeSync();
      }
    } finally {
      analytics.closeSync();
    }
    await mkdir(destination);
    created = true;
    for (const file of manifest.files) {
      const path = join(destination, file.path);
      await mkdir(dirname(path), {recursive: true});
      await copyFile(join(staging, file.path), path);
    }
    await mkdir(join(destination, 'assets'), {recursive: true});
    return manifest;
  } catch (error) {
    if (created) await rm(destination, {recursive: true, force: true});
    throw error;
  } finally {
    await input.close();
    if (staging) await rm(staging, {recursive: true, force: true});
  }
}
