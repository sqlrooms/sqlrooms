import {afterEach, beforeEach, describe, expect, it} from '@jest/globals';
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {
  createTrajectoryCheck,
  createWorkspaceStateCheck,
} from '../behavioralCheck';
import type {ExternalHarness} from '../external/harness';
import {startEvalMcpHost} from '../external/mcpHost';
import {
  runExternalScenario,
  type PreparedExternalTarget,
} from '../external/runScenario';
import {defineScenario} from '../scenario';

/**
 * A stand-in CLI: lists tools, calls `increment`, prints JSONL. It exercises
 * the real process runner, MCP host and grading without a model.
 */
const STUB_CLI = `
const call = async (method, params) => {
  const response = await fetch(process.env.STUB_MCP_URL, {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + process.env.STUB_MCP_TOKEN,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params}),
  });
  if (response.status !== 200) throw new Error(method + ' returned HTTP ' + response.status);
  const body = await response.json();
  if (body.error) throw new Error(method + ' failed: ' + JSON.stringify(body.error));
  return body;
};
const listed = await call('tools/list', {});
console.log(JSON.stringify({type: 'tools', names: listed.result.tools.map((tool) => tool.name)}));
if (process.argv[2] !== 'skip-call') {
  const called = await call('tools/call', {name: 'increment', arguments: {by: 2}});
  const count = called.result?.content?.[0]?.text;
  if (count !== '2') throw new Error('Unexpected counter value: ' + count);
}
console.log(JSON.stringify({type: 'result', text: 'Incremented the counter.'}));
`;

function stubHarness(mode: 'call' | 'skip-call' = 'call'): ExternalHarness {
  return {
    id: 'stub',
    command: process.execPath,
    model: {provider: 'stub', modelId: 'none', settings: {}},
    describe: async () => ({harnessVersion: 'stub 1'}),
    stage: (cwd) => writeFile(path.join(cwd, 'stub.mjs'), STUB_CLI),
    invocation: ({cwd, host}) => ({
      args: [path.join(cwd, 'stub.mjs'), mode],
      env: {
        PATH: process.env.PATH,
        STUB_MCP_URL: host.url,
        STUB_MCP_TOKEN: host.token,
      },
    }),
    readOutput(stdout) {
      const records = stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as {type: string; text?: string});
      const result = records.find((record) => record.type === 'result');
      return {
        finalAnswer: result?.text ?? '',
        completed: Boolean(result),
        failed: !result,
        diagnostics: [],
        skillReads: [],
      };
    },
    verifyGuidance: () => [],
  };
}

function counterTarget(): () => Promise<PreparedExternalTarget> {
  return async () => {
    let count = 0;
    return {
      createServer: ({onRequest}) => {
        const server = new Server(
          {name: 'counter', version: '1.0.0'},
          {capabilities: {tools: {}}},
        );
        server.setRequestHandler(ListToolsRequestSchema, async () => {
          onRequest('tools/list');
          return {
            tools: [
              {
                name: 'increment',
                inputSchema: {type: 'object', properties: {}},
              },
            ],
          };
        });
        server.setRequestHandler(CallToolRequestSchema, async (call) => {
          onRequest(`tools/call:${call.params.name}`, call.params);
          count += Number(call.params.arguments?.by ?? 1);
          return {content: [{type: 'text', text: String(count)}]};
        });
        return server;
      },
      snapshot: () => ({count}),
      dispose: async () => {},
    };
  };
}

const scenario = defineScenario({
  id: 'counter.increment',
  version: 1,
  title: 'Increment the counter',
  compatibleProfiles: ['counter'],
  turns: [{id: 'increment', input: 'Increment the counter by two.'}],
  expectations: [
    {checkId: 'counter-is-two', description: 'The counter reads two.'},
    {checkId: 'called-increment', description: 'The agent called increment.'},
    {checkId: 'embedded-only', description: 'Only graded in-process.'},
  ],
});

const checks = [
  createWorkspaceStateCheck({
    id: 'counter-is-two',
    evaluate: (workspace) => ({
      pass: (workspace as {count?: number})?.count === 2,
      reason: `Counter is ${JSON.stringify(workspace)}.`,
    }),
  }),
  createTrajectoryCheck({
    id: 'called-increment',
    evaluate: (events) => ({
      pass: events.some(
        (event) =>
          event.name === 'mcp-request' && event.data.name === 'increment',
      ),
      reason: 'Looked for an increment call.',
    }),
  }),
  createTrajectoryCheck({
    id: 'embedded-only',
    appliesTo: ['counter-embedded'],
    evaluate: () => ({pass: false, reason: 'Must not run externally.'}),
  }),
];

describe('runExternalScenario', () => {
  let outputDir: string;
  beforeEach(async () => {
    outputDir = await mkdtemp(path.join(tmpdir(), 'sqlrooms-external-test-'));
  });
  afterEach(async () => {
    await rm(outputDir, {recursive: true, force: true});
  });

  it('runs a harness over a real MCP host and grades the outcome', async () => {
    const harness = stubHarness();
    const evidence = await runExternalScenario({
      harness,
      harnessDescription: await harness.describe(),
      scenario,
      checks,
      outputDir,
      target: {
        type: 'counter-external-stub',
        profileName: 'counter',
        profileVersion: 1,
      },
      prepare: counterTarget(),
    });
    expect(evidence.status).toBe('passed');
    expect(evidence.finalAnswer).toBe('Incremented the counter.');
    expect(evidence.finalState).toEqual({count: 2});
    expect(evidence.metadata.mcpRequests).toEqual([
      'tools/list',
      'tools/call:increment',
    ]);
    const byId = Object.fromEntries(
      evidence.checkResults.map((result) => [result.checkId, result]),
    );
    expect(byId['called-increment']?.pass).toBe(true);
    expect(byId['embedded-only']?.notApplicable).toBe(true);
    const stored = JSON.parse(
      await readFile(
        path.join(outputDir, 'counter.increment.evidence.json'),
        'utf8',
      ),
    );
    expect(stored.runId).toBe(evidence.runId);
  });

  it('reports a missing MCP invocation as an error, not a failure', async () => {
    const harness = stubHarness('skip-call');
    const evidence = await runExternalScenario({
      harness,
      harnessDescription: {},
      scenario,
      outputDir,
      target: {
        type: 'counter-external-stub',
        profileName: 'counter',
        profileVersion: 1,
      },
      prepare: counterTarget(),
    });
    expect(evidence.status).toBe('error');
    expect(evidence.metadata.failureKind).toBe('transport');
    expect(evidence.checkResults).toEqual([]);
  });

  it('records a missing executable as a setup error', async () => {
    const harness = {...stubHarness(), command: 'sqlrooms-no-such-cli'};
    const evidence = await runExternalScenario({
      harness,
      harnessDescription: {},
      scenario,
      outputDir,
      repetition: 1,
      target: {
        type: 'counter-external-stub',
        profileName: 'counter',
        profileVersion: 1,
      },
      prepare: counterTarget(),
    });
    expect(evidence.status).toBe('error');
    expect(evidence.metadata.failureKind).toBe('setup');
    await readFile(path.join(outputDir, 'counter.increment.r1.evidence.json'));
  });

  it('records a failed preparation without grading the empty state', async () => {
    const harness = stubHarness();
    const evidence = await runExternalScenario({
      harness,
      harnessDescription: {},
      scenario,
      checks,
      outputDir,
      target: {
        type: 'counter-external-stub',
        profileName: 'counter',
        profileVersion: 1,
      },
      prepare: async () => {
        throw new Error('No workspace.');
      },
    });
    expect(evidence.status).toBe('error');
    expect(evidence.metadata.failureKind).toBe('setup');
    expect(evidence.checkResults).toEqual([]);
    await readFile(path.join(outputDir, 'counter.increment.evidence.json'));
  });

  it('classifies an operation error recorded by the application', async () => {
    const harness = stubHarness();
    const prepareCounter = counterTarget();
    const evidence = await runExternalScenario({
      harness,
      harnessDescription: {},
      scenario,
      outputDir,
      target: {
        type: 'counter-external-stub',
        profileName: 'counter',
        profileVersion: 1,
      },
      prepare: async (recorder) => {
        recorder.recordError({name: 'QueryError', message: 'Query failed.'});
        return prepareCounter();
      },
    });
    expect(evidence.status).toBe('error');
    expect(evidence.metadata.failureKind).toBe('operation');
  });

  it('runs without a deadline when the timeout is zero', async () => {
    const harness = stubHarness();
    const evidence = await runExternalScenario({
      harness,
      harnessDescription: {},
      scenario,
      outputDir,
      timeoutMs: 0,
      target: {
        type: 'counter-external-stub',
        profileName: 'counter',
        profileVersion: 1,
      },
      prepare: counterTarget(),
    });
    expect(evidence.status).toBe('passed');
    expect(evidence.finalState).toEqual({count: 2});
  });
});

describe('startEvalMcpHost', () => {
  it('rejects requests without the bearer token', async () => {
    const host = await startEvalMcpHost({
      createServer: () =>
        new Server({name: 'empty', version: '1.0.0'}, {capabilities: {}}),
    });
    try {
      const response = await fetch(host.url, {method: 'POST', body: '{}'});
      expect(response.status).toBe(403);
      const credential = JSON.parse(
        await readFile(host.credentialFile, 'utf8'),
      );
      expect(credential).toEqual({token: host.token, mcpUrl: host.url});
    } finally {
      await host.dispose();
    }
  });

  it('answers 500 and reports a server factory that throws', async () => {
    const errors: unknown[] = [];
    const host = await startEvalMcpHost({
      createServer: () => {
        throw new Error('No schema.');
      },
      onError: (error) => errors.push(error),
    });
    try {
      const response = await fetch(host.url, {
        method: 'POST',
        headers: {authorization: `Bearer ${host.token}`},
        body: '{}',
      });
      expect(response.status).toBe(500);
      expect(String(errors[0])).toMatch(/No schema/);
    } finally {
      await host.dispose();
    }
  });

  it('settles a request whose client disconnected mid-call', async () => {
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => (release = resolve));
    let started!: () => void;
    const called = new Promise<void>((resolve) => (started = resolve));
    const host = await startEvalMcpHost({
      createServer: () => {
        const server = new Server(
          {name: 'slow', version: '1.0.0'},
          {capabilities: {tools: {}}},
        );
        server.setRequestHandler(CallToolRequestSchema, async () => {
          started();
          await blocked;
          return {content: []};
        });
        return server;
      },
    });
    const controller = new AbortController();
    const request = fetch(host.url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${host.token}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {name: 'slow', arguments: {}},
      }),
    }).catch(() => undefined);
    try {
      await called;
      controller.abort();
      await request;
      // Disposal must not wait on the abandoned response.
      await host.dispose();
    } finally {
      release();
      await host.dispose();
    }
  });
});
