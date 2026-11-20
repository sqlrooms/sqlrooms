import {execFileSync} from 'node:child_process';
import {cp, readFile, rm} from 'node:fs/promises';
import path from 'node:path';
import type {
  ExternalHarness,
  HarnessHostConnection,
  HarnessOutput,
} from './harness.js';

/** Native Claude print mode, restricted to guidance reads and the isolated MCP host. */
export function claudeArguments(options: {
  pluginDir: string;
  /** MCP configuration file; usually inside the staged plugin. */
  mcpConfig: string;
  /** Tool permissions granted without prompting, such as `mcp__name__*`. */
  allowedTools: string[];
  appendSystemPrompt: string;
  /** Built-in tools available to the agent; defaults to `Read` and `Skill`. */
  tools?: string[];
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
    options.mcpConfig,
    '--tools',
    (options.tools ?? ['Read', 'Skill']).join(','),
    '--allowedTools',
    options.allowedTools.join(','),
    '--permission-mode',
    'dontAsk',
    ...(options.model ? ['--model', options.model] : []),
    '--append-system-prompt',
    options.appendSystemPrompt,
    '--',
    options.prompt,
  ];
}

type Block = {
  type: string;
  id?: string;
  name?: string;
  input?: {skill?: string; file_path?: string};
  tool_use_id?: string;
  is_error?: boolean;
  content?: string | Array<{type: string; text?: string}>;
};
type StreamRecord = {
  type: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  errors?: string[];
  model?: string;
  message?: {model?: string; content?: Block[]};
  usage?: {input_tokens?: number; output_tokens?: number};
};

/** Reads Claude's public stream-json events; only the result event is graded. */
export function readClaudeOutput(
  stdout: string,
  options: {
    /** Native skill identifier, such as `sqlrooms:sqlrooms`. */
    skillId: string;
    /** Path fragment that identifies reads of the skill's files. */
    skillPathFragment: string;
  },
): HarnessOutput {
  const records = stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as StreamRecord);
  const uses = new Map<string, Block>();
  const skillReads: HarnessOutput['skillReads'] = [];
  let skillInvoked = false;
  for (const record of records) {
    for (const block of record.message?.content ?? []) {
      if (record.type === 'assistant' && block.type === 'tool_use' && block.id)
        uses.set(block.id, block);
      if (
        record.type !== 'user' ||
        block.type !== 'tool_result' ||
        block.is_error
      )
        continue;
      const use = uses.get(block.tool_use_id ?? '');
      if (use?.name === 'Skill' && use.input?.skill === options.skillId)
        skillInvoked = true;
      if (
        use?.name !== 'Read' ||
        !use.input?.file_path?.includes(options.skillPathFragment)
      )
        continue;
      const output =
        typeof block.content === 'string'
          ? block.content
          : (block.content ?? []).map((part) => part.text ?? '').join('\n');
      // Read includes line-number prefixes; retain the raw stream separately.
      // Strip only the prefix so content indentation survives.
      skillReads.push({
        command: use.input.file_path,
        output: output.replace(/^ *\d+(?:→|\t)/gm, ''),
      });
    }
  }
  const result = [...records]
    .reverse()
    .find((record) => record.type === 'result');
  return {
    finalAnswer: result?.result ?? '',
    completed: Boolean(result),
    failed: !result || result.is_error === true || result.subtype !== 'success',
    // An error result's text carries API failures such as a rejected login.
    diagnostics: [
      ...(result?.errors ?? []),
      ...(result?.is_error && result.result ? [result.result] : []),
    ].map((message) => ({message, severity: 'error' as const})),
    usage: result?.usage,
    observedModelId:
      records.find(
        (record) =>
          record.type === 'assistant' &&
          record.message?.model &&
          record.message.model !== '<synthetic>',
      )?.message?.model ?? null,
    skillReads,
    skillInvoked,
  };
}

/** Options for {@link createClaudeHarness}. */
export type ClaudeHarnessOptions = {
  /** Plugin directory copied to `<cwd>/plugin`. */
  pluginDir: string;
  /** Extra directories copied into the staged plugin, such as a canonical skill kept outside it. */
  pluginFiles?: Array<{from: string; to: string}>;
  /** Native skill identifier, such as `sqlrooms:sqlrooms`. */
  skillId: string;
  /** Skill directory relative to the staged plugin, such as `skills/sqlrooms`. */
  skillPath: string;
  /** Reference files (relative to the skill) whose successful reads are required. */
  requiredReferences?: string[];
  /** Paths removed from the staged plugin, such as its own MCP configuration. */
  excludeFromPlugin?: string[];
  /** MCP configuration relative to the staged plugin; defaults to `mcp.json`. */
  mcpConfig?: string;
  /**
   * Extra built-in tools, such as `ListMcpResourcesTool` and
   * `ReadMcpResourceTool` when guidance is served as MCP resources. Each is
   * also allowed without prompting.
   */
  extraTools?: string[];
  /**
   * Whether a native skill invocation and full read are required for a run to
   * count. Defaults to true. Turn off when the plugin skill only bootstraps
   * the connection and the guidance comes over MCP; grade that with checks.
   */
  requireSkillRead?: boolean;
  /** MCP tool permission pattern, such as `mcp__sqlrooms__*`. */
  mcpTools: string;
  appendSystemPrompt: string;
  /** Explicit evaluation model; Claude's configured default otherwise. */
  model?: string;
  /** Extra environment for the plugin's MCP configuration, such as its URL and credentials. */
  env?: (input: {
    cwd: string;
    pluginDir: string;
    host: HarnessHostConnection;
  }) => NodeJS.ProcessEnv;
};

/** Runs actual Claude Code with a natively loaded plugin over a real MCP connection. */
export function createClaudeHarness(
  options: ClaudeHarnessOptions,
): ExternalHarness {
  const model = options.model?.trim() || undefined;
  const skillName = path.basename(options.skillPath);
  let skillContents = '';
  return {
    id: 'claude',
    command: 'claude',
    model: {
      provider: 'claude-harness',
      modelId: model ?? 'harness-default',
      settings: {},
    },
    async describe() {
      const version = execFileSync('claude', ['--version'], {
        encoding: 'utf8',
        timeout: 10_000,
      }).trim();
      const manifestPath = path.join(
        options.pluginDir,
        '.claude-plugin/plugin.json',
      );
      const plugin = JSON.parse(await readFile(manifestPath, 'utf8'));
      return {harnessVersion: version, plugin};
    },
    async stage(cwd) {
      const staged = path.join(cwd, 'plugin');
      await cp(options.pluginDir, staged, {recursive: true});
      for (const file of options.pluginFiles ?? [])
        await cp(file.from, path.join(staged, file.to), {recursive: true});
      for (const excluded of options.excludeFromPlugin ?? [])
        await rm(path.join(staged, excluded), {recursive: true, force: true});
      skillContents = await readFile(
        path.join(staged, options.skillPath, 'SKILL.md'),
        'utf8',
      );
    },
    invocation({cwd, host, prompt}) {
      const pluginDir = path.join(cwd, 'plugin');
      return {
        args: claudeArguments({
          pluginDir,
          mcpConfig: path.join(pluginDir, options.mcpConfig ?? 'mcp.json'),
          allowedTools: [
            `Read(./plugin/${options.skillPath}/**)`,
            `Skill(${options.skillId})`,
            options.mcpTools,
            ...(options.extraTools ?? []),
          ],
          tools: ['Read', 'Skill', ...(options.extraTools ?? [])],
          appendSystemPrompt: options.appendSystemPrompt,
          model,
          prompt,
        }),
        env: {
          ...process.env,
          ...options.env?.({cwd, pluginDir, host}),
        },
      };
    },
    readOutput: (stdout) =>
      readClaudeOutput(stdout, {
        skillId: options.skillId,
        skillPathFragment: `/${options.skillPath}/`,
      }),
    verifyGuidance(output) {
      const missing: string[] = [];
      if (
        options.requireSkillRead !== false &&
        (!output.skillInvoked ||
          !output.skillReads.some((read) =>
            read.output.includes(skillContents.trim()),
          ))
      )
        missing.push(
          `Successful native ${skillName} skill read was not observed.`,
        );
      const references = options.requiredReferences ?? [];
      if (
        !references.every((name) =>
          output.skillReads.some(
            (read) =>
              read.command.endsWith('/references/' + name) &&
              read.output.length > 100,
          ),
        )
      )
        missing.push('Successful focused reference reads were not observed.');
      return missing;
    },
  };
}
