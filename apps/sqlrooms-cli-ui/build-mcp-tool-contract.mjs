import {readFile, writeFile} from 'node:fs/promises';
import {transformWithEsbuild} from 'vite';
const source = await readFile(
  new URL('../../packages/mcp/src/localMcpToolContract.ts', import.meta.url),
  'utf8',
);
const {code} = await transformWithEsbuild(source, 'cliMcpToolContract.ts', {
  loader: 'ts',
});
const contract = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);
await writeFile(
  new URL(
    '../../python/sqlrooms/sqlrooms/mcp_tool_contract.json',
    import.meta.url,
  ),
  JSON.stringify(
    {
      version: contract.LOCAL_MCP_CONTRACT_VERSION,
      tools: Object.values(contract.LOCAL_MCP_TOOLS),
    },
    null,
    2,
  ) + '\n',
);
