// Dedicated Claude headersHelper output, never the MCP protocol stream.
import {open, lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';

try {
  if (process.platform === 'win32') throw new Error('Untested ACLs');
  const filename = process.env.SQLROOMS_CREDENTIAL_FILE;
  const parent = await lstat(path.dirname(filename));
  if (
    !parent.isDirectory() ||
    parent.uid !== process.getuid() ||
    parent.mode & 0o077
  )
    throw new Error('Unsafe directory');
  const file = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  let record;
  try {
    const info = await file.stat();
    if (!info.isFile() || info.uid !== process.getuid() || info.mode & 0o077)
      throw new Error('Unsafe file');
    record = JSON.parse(await file.readFile('utf8'));
  } finally {
    await file.close();
  }
  const endpoint =
    process.env.CLAUDE_CODE_MCP_SERVER_URL || process.env.SQLROOMS_MCP_URL;
  if (endpoint !== record.mcpUrl) throw new Error('Wrong endpoint');
  process.stdout.write(
    JSON.stringify({Authorization: `Bearer ${record.token}`}),
  );
} catch {
  process.stderr.write(
    'SQLRooms authentication requires a private credential file for this endpoint.\n',
  );
  process.exitCode = 1;
}
