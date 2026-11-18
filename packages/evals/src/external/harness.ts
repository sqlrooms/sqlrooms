import type {JsonObject} from '../json.js';

/** A diagnostic reported by an external harness. */
export type HarnessDiagnostic = {
  message: string;
  severity: 'warning' | 'error';
};

/** A successful read of skill guidance observed in harness output. */
export type HarnessSkillRead = {
  /** The command or file path that performed the read. */
  command: string;
  /** The content returned to the agent. */
  output: string;
};

/** Observations parsed from one harness run's structured output. */
export type HarnessOutput = {
  /** The final assistant answer; progress messages are not graded. */
  finalAnswer: string;
  /** Whether the harness reported a completed turn. */
  completed: boolean;
  /** Whether the harness reported a failed turn or an error diagnostic. */
  failed: boolean;
  diagnostics: HarnessDiagnostic[];
  usage?: {input_tokens?: number; output_tokens?: number};
  /** Model reported by actual assistant events, when the harness emits it. */
  observedModelId?: string | null;
  skillReads: HarnessSkillRead[];
  /** Whether a native skill invocation was observed, when the harness has one. */
  skillInvoked?: boolean;
};

/** Connection details for the evaluation MCP host. */
export type HarnessHostConnection = {
  url: string;
  token: string;
  credentialFile: string;
};

/**
 * An actual external agent CLI that drives a workspace over MCP.
 *
 * Adapters own only the CLI contract: staging guidance into a temporary
 * working directory, building the invocation, and parsing output. The
 * workspace, MCP surface and grading belong to the application.
 */
export type ExternalHarness = {
  /** Stable identifier recorded in evidence, such as `codex` or `claude`. */
  readonly id: string;
  /** Executable to spawn. */
  readonly command: string;
  /** Configured model identity recorded in evidence. */
  readonly model: {provider: string; modelId: string; settings: JsonObject};
  /** Resolves the harness version and other manifest facts before any run. */
  describe(): Promise<JsonObject>;
  /** Copies guidance (skills, plugins, instructions) into the run directory. */
  stage(cwd: string): Promise<void>;
  /** Builds the exact process invocation for one prompt. */
  invocation(input: {
    cwd: string;
    host: HarnessHostConnection;
    prompt: string;
  }): {args: string[]; env: NodeJS.ProcessEnv};
  /** Parses the harness's structured stdout. */
  readOutput(stdout: string): HarnessOutput;
  /** Returns one message per required guidance read that was not observed. */
  verifyGuidance(output: HarnessOutput): string[];
};
