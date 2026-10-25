import {constants} from 'node:fs';
import {lstat, mkdtemp, open, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

/** Store a native credential handoff outside the workspace, owner-only on POSIX. */
export async function writeCredentialFile(value: {
  token: string;
  binding: string;
  apiUrl: string;
  mcpUrl: string;
}) {
  if (process.platform === 'win32' || !process.getuid)
    throw new Error(
      'Private credential storage requires tested POSIX permissions.',
    );
  const directory = await mkdtemp(join(tmpdir(), 'roomie-credentials-'));
  const path = join(directory, 'credential.json');
  const close = () => rm(directory, {recursive: true, force: true});
  try {
    const info = await lstat(directory);
    if (
      !info.isDirectory() ||
      info.uid !== process.getuid() ||
      info.mode & 0o077
    )
      throw new Error('Credential directory must be owner-only.');
    const file = await open(
      path,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    try {
      await file.writeFile(JSON.stringify(value));
      await file.sync();
    } finally {
      await file.close();
    }
    return {path, close};
  } catch (error) {
    await close();
    throw error;
  }
}
