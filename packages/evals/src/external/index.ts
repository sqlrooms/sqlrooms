/**
 * Node-only runners for evaluating actual external agent harnesses (Codex,
 * Claude Code) against an application workspace over a real MCP host.
 *
 * Applications supply the workspace, MCP server, snapshot and checks through
 * {@link runExternalScenario}'s `prepare` hook; this module owns process
 * supervision, harness invocation and output parsing, the MCP transport, and
 * run evidence.
 *
 * @packageDocumentation
 */

export * from './harness.js';
export * from './process.js';
export * from './codex.js';
export * from './codexSkills.js';
export * from './claude.js';
export * from './mcpHost.js';
export * from './runScenario.js';
export * from './supervise.js';
export * from './promptfooProvider.js';
