import {readFile, writeFile} from 'node:fs/promises';
import {transformWithEsbuild} from 'vite';
const source = await readFile(
  new URL('../../packages/mcp/src/localMcpToolContract.ts', import.meta.url),
  'utf8',
);
const {code} = await transformWithEsbuild(source, 'localMcpToolContract.ts', {
  loader: 'ts',
});
const contract = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);
await writeFile(
  new URL('../../python/roomie/roomie/mcp_tool_contract.json', import.meta.url),
  JSON.stringify(
    {
      version: contract.LOCAL_MCP_CONTRACT_VERSION,
      tools: Object.values(contract.LOCAL_MCP_TOOLS),
    },
    null,
    2,
  ) + '\n',
);

// Emit the same fixed composition shipped by the UI for host discovery/guidance.
const manifestSource = await readFile(
  new URL('./src/capabilities.ts', import.meta.url),
  'utf8',
);
const {code: manifestCode} = await transformWithEsbuild(
  manifestSource,
  'capabilities.ts',
  {loader: 'ts'},
);
const {ROOMIE_CAPABILITIES: capabilities} = await import(
  `data:text/javascript;base64,${Buffer.from(manifestCode).toString('base64')}`
);
await writeFile(
  new URL('../../python/roomie/roomie/capabilities.json', import.meta.url),
  JSON.stringify(capabilities, null, 2) + '\n',
);
const guidePath = new URL(
  '../../python/roomie/roomie/claude_plugin/skills/roomie/SKILL.md',
  import.meta.url,
);
const guide = (await readFile(guidePath, 'utf8'))
  .split('<!-- generated-capabilities -->')[0]
  .trimEnd();
await writeFile(
  guidePath,
  `${guide}\n\n<!-- generated-capabilities -->\n\nSupported composition (generated from the UI manifest):\n\n- Artifacts: ${capabilities.artifacts.join(', ')}.\n- Analytical blocks: ${capabilities.blocks.join(', ')}.\n- Chart types: ${capabilities.chartTypes.join(', ')}.\n- Dashboard panels: ${capabilities.dashboardPanels.join(', ')}.\n`,
);
