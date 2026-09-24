/** Native Claude print mode, restricted to guidance reads and the isolated MCP host. */
export function claudeArguments(options: {
  pluginDir: string;
  model?: string;
  prompt: string;
}) {
  return [
    '--print',
    '--verbose',
    '--output-format',
    'stream-json',
    '--no-session-persistence',
    '--plugin-dir',
    options.pluginDir,
    '--strict-mcp-config',
    '--mcp-config',
    `${options.pluginDir}/mcp.json`,
    '--tools',
    'Read,Skill',
    '--allowedTools',
    'Read(./plugin/skills/sqlrooms/**),Skill(sqlrooms:sqlrooms),mcp__sqlrooms__*',
    '--permission-mode',
    'dontAsk',
    ...(options.model ? ['--model', options.model] : []),
    '--append-system-prompt',
    'Use the native sqlrooms:sqlrooms skill before working. Explicitly read its SKILL.md and the documents, charts, and maps references for this auditable run. Use only MCP for workspace reads and writes. The host is an isolated disposable evaluation fixture; rendering is unavailable. Do not read repository source, evaluation evidence, or unrelated user files.',
    '--',
    options.prompt,
  ];
}
