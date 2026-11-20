import {execFileSync} from 'node:child_process';
import {cp, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {findOtherCodexSkills} from './codexSkills.js';
import type {ExternalHarness, HarnessOutput} from './harness.js';

/** Codex's supported CLI automation and repo skill discovery, with explicit local MCP configuration. */
export function codexArguments(options: {
  cwd: string;
  url: string;
  model: string;
  modelProvider?: 'codex' | 'openrouter';
  prompt: string;
  disabledSkills: string[];
  /** Skill invoked with `$<name>` before the unchanged prompt. */
  skillName: string;
  /** MCP server name in Codex configuration. */
  mcpServerName: string;
  /** Environment variable that carries the MCP bearer token. */
  tokenEnvVar: string;
}) {
  return [
    'exec',
    '--ignore-user-config',
    '--ignore-rules',
    '--ephemeral',
    '--skip-git-repo-check',
    '--sandbox',
    'read-only',
    '--json',
    '--color',
    'never',
    '-C',
    options.cwd,
    '--model',
    options.model,
    ...(options.modelProvider === 'openrouter'
      ? [
          '-c',
          'model_provider="openrouter"',
          '-c',
          'model_providers.openrouter={name="OpenRouter",base_url="https://openrouter.ai/api/v1",env_key="OPENROUTER_API_KEY",wire_api="responses",requires_openai_auth=false}',
        ]
      : []),
    '-c',
    'model_reasoning_effort="medium"',
    '-c',
    'skills.config=[' +
      options.disabledSkills
        .map((skill) => `{path=${JSON.stringify(skill)},enabled=false}`)
        .join(',') +
      ']',
    '-c',
    `mcp_servers.${options.mcpServerName}={url=${JSON.stringify(options.url)},bearer_token_env_var=${JSON.stringify(options.tokenEnvVar)},required=true,startup_timeout_sec=20,tool_timeout_sec=35}`,
    '-c',
    `mcp_servers.${options.mcpServerName}.default_tools_approval_mode="approve"`,
    `$${options.skillName}\n\n` + options.prompt,
  ];
}

/** Extracts observations from Codex JSONL without treating progress text as the final answer. */
export function readCodexOutput(
  stdout: string,
  options: {skillName: string},
): HarnessOutput {
  const skillPath = `.agents/skills/${options.skillName}/`;
  const records = stdout
    .split('\n')
    .filter(Boolean)
    .map(
      (line) =>
        JSON.parse(line) as {
          type: string;
          item?: {
            type?: string;
            message?: string;
            text?: string;
            command?: string;
            aggregated_output?: string;
            exit_code?: number;
          };
          usage?: {input_tokens?: number; output_tokens?: number};
          message?: string;
          error?: {message?: string};
        },
    );
  const completedItems = records
    .filter((record) => record.type === 'item.completed')
    .map((record) => record.item);
  const messages = completedItems.filter(
    (item) => item?.type === 'agent_message',
  );
  const usages = records
    .filter((record) => record.type === 'turn.completed')
    .map((record) => record.usage);
  const diagnostics = completedItems
    .filter(
      (item) =>
        item?.type === 'error' ||
        (item?.type === 'command_execution' && item.exit_code !== 0),
    )
    .map((item) => ({
      message:
        item?.message ??
        `Command exited with ${item?.exit_code}: ${item?.command}`,
      severity:
        item?.message &&
        (item.message.startsWith('Skill descriptions were shortened to fit') ||
          /^Model metadata for `[^`]+` not found\. Defaulting to fallback metadata; this can degrade performance and cause issues\.$/.test(
            item.message,
          ))
          ? ('warning' as const)
          : ('error' as const),
    }));
  // Turn-level failures, such as a rejected login or model, are not items.
  for (const record of records) {
    const message =
      record.type === 'error'
        ? record.message
        : record.type === 'turn.failed'
          ? record.error?.message
          : undefined;
    if (message) diagnostics.push({message, severity: 'error'});
  }
  return {
    diagnostics,
    finalAnswer: messages[messages.length - 1]?.text ?? '',
    usage: usages[usages.length - 1],
    failed:
      records.some(
        (record) => record.type === 'turn.failed' || record.type === 'error',
      ) || diagnostics.some((item) => item.severity === 'error'),
    completed: records.some((record) => record.type === 'turn.completed'),
    skillReads: completedItems
      .filter(
        (item) =>
          item?.type === 'command_execution' &&
          item.exit_code === 0 &&
          item.command?.includes(skillPath),
      )
      .map((item) => ({
        command: item!.command!,
        output: item!.aggregated_output ?? '',
      })),
  };
}

/** Options for {@link createCodexHarness}. */
export type CodexHarnessOptions = {
  /** Canonical skill directory, copied to `.agents/skills/<skillName>`. */
  skillDir: string;
  skillName: string;
  /** Host instructions written to `AGENTS.md`; never the checks. */
  instructions: string;
  /** Defaults to `gpt-5.5`. */
  model?: string;
  /** `codex` uses existing Codex auth; `openrouter` uses `OPENROUTER_API_KEY`. */
  modelProvider?: 'codex' | 'openrouter';
  /** Defaults to the skill name. */
  mcpServerName?: string;
  /** Defaults to `SQLROOMS_EVAL_MCP_TOKEN`. */
  tokenEnvVar?: string;
  /** Overrides discovery of other local skills to disable. */
  findDisabledSkills?: () => Promise<string[]>;
};

/** Runs the actual Codex CLI with native skill discovery over a real MCP connection. */
export function createCodexHarness(
  options: CodexHarnessOptions,
): ExternalHarness {
  const modelProvider = options.modelProvider ?? 'codex';
  if (modelProvider !== 'codex' && modelProvider !== 'openrouter')
    throw new Error(`Unsupported Codex model provider: ${modelProvider}`);
  if (modelProvider === 'openrouter' && !process.env.OPENROUTER_API_KEY?.trim())
    throw new Error('Missing OPENROUTER_API_KEY for the external harness.');
  const model = (options.model ?? 'gpt-5.5').trim();
  if (!model) throw new Error('The Codex evaluation model must be non-empty.');
  const mcpServerName = options.mcpServerName ?? options.skillName;
  const tokenEnvVar = options.tokenEnvVar ?? 'SQLROOMS_EVAL_MCP_TOKEN';
  let disabledSkills: string[] = [];
  /** SKILL.md as first read; staged and verified for every run. */
  let skillContents = '';
  // Loaded once, by `describe()` or the first `stage()`, whichever runs first,
  // so a caller that skips `describe()` still disables other local skills and
  // verifies against real contents.
  let loaded: Promise<void> | undefined;
  const load = () =>
    (loaded ??= (async () => {
      disabledSkills = await (
        options.findDisabledSkills ?? findOtherCodexSkills
      )();
      skillContents = await readFile(
        path.join(options.skillDir, 'SKILL.md'),
        'utf8',
      );
      if (!skillContents.trim())
        throw new Error(`${options.skillName} SKILL.md is empty.`);
    })());
  return {
    id: 'codex',
    command: 'codex',
    model: {
      provider: modelProvider === 'openrouter' ? 'openrouter' : 'codex-harness',
      modelId: model,
      settings: {reasoningEffort: 'medium'},
    },
    async describe() {
      const version = execFileSync('codex', ['--version'], {
        encoding: 'utf8',
        timeout: 10_000,
      }).trim();
      await load();
      return {harnessVersion: version, disabledSkillPaths: disabledSkills};
    },
    async stage(cwd) {
      await load();
      const staged = path.join(cwd, '.agents/skills', options.skillName);
      await cp(options.skillDir, staged, {recursive: true});
      // Stage the contents `verifyGuidance` checks, even if SKILL.md changed
      // since it was first read.
      await writeFile(path.join(staged, 'SKILL.md'), skillContents);
      await writeFile(path.join(cwd, 'AGENTS.md'), options.instructions);
    },
    invocation({cwd, host, prompt}) {
      return {
        args: codexArguments({
          cwd,
          url: host.url,
          model,
          modelProvider,
          prompt,
          disabledSkills,
          skillName: options.skillName,
          mcpServerName,
          tokenEnvVar,
        }),
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          CODEX_HOME: process.env.CODEX_HOME,
          TMPDIR: process.env.TMPDIR,
          ...(modelProvider === 'openrouter'
            ? {OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY}
            : {}),
          [tokenEnvVar]: host.token,
        },
      };
    },
    readOutput: (stdout) =>
      readCodexOutput(stdout, {skillName: options.skillName}),
    verifyGuidance(output) {
      // Empty contents would match any read; staging guarantees they're set.
      return skillContents.trim() &&
        output.skillReads.some((read) =>
          read.output.includes(skillContents.trim()),
        )
        ? []
        : [
            `Successful native ${options.skillName} skill read was not observed.`,
          ];
    },
  };
}
