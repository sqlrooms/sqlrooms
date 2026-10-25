import {resolve} from 'node:path';
import {openWorkspace, startWorkspaceServer} from '../dist/index.mjs';
const workspace = await openWorkspace({directory: process.argv[2]});
const server = await startWorkspaceServer({
  workspace,
  harness: {
    trustedLocal: true,
    executable: resolve('test/scripted-codex.mjs'),
    deadlineMs: 30000,
  },
});
console.log(
  JSON.stringify({url: server.url, credentialPath: server.credentialPath}),
);
process.on('SIGTERM', async () => {
  await server.dispose();
  await workspace.dispose();
  process.exit();
});
