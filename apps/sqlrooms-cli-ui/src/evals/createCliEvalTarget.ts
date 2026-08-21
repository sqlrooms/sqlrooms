import {createArtifactAiSlice} from '@sqlrooms/artifacts/ai';
import {createArtifactsSlice} from '@sqlrooms/artifacts';
import {createAiSlice, getChatRequestErrorMessage} from '@sqlrooms/ai';
import {createDeckMapsSlice, ensureDeckMapResourceState} from '@sqlrooms/deck';
import {createBlockDocumentsSlice} from '@sqlrooms/documents';
import {createNodeDuckDbConnector} from '@sqlrooms/duckdb-node';
import {
  RUN_EVIDENCE_SCHEMA_VERSION,
  RunEvidenceSchema,
  evaluateOracles,
  summarizeOracleResults,
  type BehavioralOracle,
  type JsonObject,
  type ObservedError,
  type ObservedMutation,
  type RunEvidence,
  type ScenarioDefinition,
} from '@sqlrooms/evals';
import {createRoomShellSlice} from '@sqlrooms/room-shell';
import type {LanguageModel, UIMessage} from 'ai';
import type {StoreApi} from 'zustand';
import {createStore} from 'zustand/vanilla';
import {createCliAiInstructions} from '../createCliAiInstructions';
import {createCliAiTools} from '../createCliAiTools';
import {createCliHeadlessArtifactTypes} from '../createCliWorksheetArtifactDefinition';
import {artifactChatAssociationMiddleware} from '../artifactChatAssociation';
import {formatRunContextInstructions} from '../context/formatRunContextInstructions';
import {getRunContext} from '../context/getRunContext';
import {
  resolveCliCapabilityProfile,
  type CliCapabilityProfile,
} from '../profiles';
import {
  registerCliCapabilityProfileCommands,
  unregisterCliCapabilityProfileCommands,
} from '../registerCliCapabilityProfileCommands';
import type {RoomState} from '../store-types';
import {createCliEvalDuckDbOptions} from './fixture';
import {snapshotCliEvalState} from './snapshot';

const DEFAULT_TIMEOUT_MS = 20_000;

class CliEvalTimeoutError extends Error {
  override name = 'CliEvalTimeoutError';
}

function getLanguageModelIdentity(model: LanguageModel): {
  provider: string;
  modelId: string;
} {
  return typeof model === 'string'
    ? {provider: 'gateway', modelId: model}
    : {provider: model.provider, modelId: model.modelId};
}

export type CliEvalTargetOptions = {
  model: LanguageModel;
  modelProvider?: string;
  modelId?: string;
  repository?: RunEvidence['repository'];
  timeoutMs?: number;
  sensitiveValues?: readonly string[];
  now?: () => Date;
  modelSettings?: JsonObject;
  configuredRevision?: string;
  upstreamProvider?: string;
  maxSteps?: number;
};

export type CliEvalRunOptions = {
  scenario: ScenarioDefinition;
  oracles?: readonly BehavioralOracle[];
  repetition?: number;
};

export type CliEvalTarget = {
  readonly profile: CliCapabilityProfile;
  readonly store: StoreApi<RoomState>;
  initialize(): Promise<void>;
  run(options: CliEvalRunOptions): Promise<RunEvidence>;
  dispose(): Promise<void>;
};

function textFromMessages(messages: readonly UIMessage[]): string {
  const lastAssistant = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant');
  return (lastAssistant?.parts ?? [])
    .filter(
      (part): part is Extract<typeof part, {type: 'text'}> =>
        part.type === 'text',
    )
    .map((part) => part.text)
    .join('\n');
}

function errorsFromMessages(
  messages: readonly UIMessage[],
  sensitiveValues: readonly string[],
): ObservedError[] {
  const errors = new Set<string>();
  for (const message of messages) {
    const metadataError = getChatRequestErrorMessage(message)?.error;
    if (metadataError) errors.add(metadataError);
    for (const part of message.parts ?? []) {
      if (!part || typeof part !== 'object') continue;
      const record = part as {type?: unknown; data?: unknown};
      if (
        record.type === 'data-sqlrooms-chat-error' &&
        record.data &&
        typeof record.data === 'object'
      ) {
        const error = (record.data as {error?: unknown}).error;
        if (typeof error === 'string') errors.add(error);
      }
    }
  }
  return [...errors].map((error) =>
    observedError(new Error(error), sensitiveValues),
  );
}

function usageFromMessages(
  messages: readonly UIMessage[],
): RunEvidence['usage'] {
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  for (const message of messages) {
    const usage = (
      message.metadata as
        | {
            tokenUsage?: {
              inputTokens?: number;
              outputTokens?: number;
              totalTokens?: number;
            };
          }
        | undefined
    )?.tokenUsage;
    const messageInputTokens = usage?.inputTokens ?? 0;
    const messageOutputTokens = usage?.outputTokens ?? 0;
    inputTokens += messageInputTokens;
    outputTokens += messageOutputTokens;
    totalTokens +=
      usage?.totalTokens ?? messageInputTokens + messageOutputTokens;
  }
  if (inputTokens === 0 && outputTokens === 0 && totalTokens === 0) {
    return undefined;
  }
  return {inputTokens, outputTokens, totalTokens, grader: {totalTokens: 0}};
}

function redact(value: string, sensitiveValues: readonly string[]): string {
  return sensitiveValues.reduce(
    (result, secret) =>
      secret ? result.split(secret).join('[REDACTED]') : result,
    value,
  );
}

function redactEvidenceValue(
  value: unknown,
  sensitiveValues: readonly string[],
): unknown {
  if (typeof value === 'string') return redact(value, sensitiveValues);
  if (Array.isArray(value)) {
    return value.map((item) => redactEvidenceValue(item, sensitiveValues));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        redact(key, sensitiveValues),
        redactEvidenceValue(item, sensitiveValues),
      ]),
    );
  }
  return value;
}

function redactRunEvidence(
  evidence: RunEvidence,
  sensitiveValues: readonly string[],
): RunEvidence {
  return redactEvidenceValue(evidence, sensitiveValues) as RunEvidence;
}

function observedError(
  error: unknown,
  sensitiveValues: readonly string[],
): ObservedError {
  const source = error instanceof Error ? error : new Error(String(error));
  return {
    name: source.name,
    message: redact(source.message, sensitiveValues),
    metadata: source.stack
      ? {stack: redact(source.stack, sensitiveValues)}
      : {},
  };
}

function waitForSession(
  store: StoreApi<RoomState>,
  sessionId: string,
  timeoutMs: number,
): {completion: Promise<void>; cancel(): void} {
  let settled = false;
  let unsubscribe = () => {};
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let resolveCompletion = () => {};
  const cleanup = () => {
    if (timeout !== undefined) clearTimeout(timeout);
    unsubscribe();
  };
  const completion = new Promise<void>((resolve, reject) => {
    resolveCompletion = resolve;
    let sawRunning = false;
    timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(
        new CliEvalTimeoutError(
          `CLI eval session timed out after ${timeoutMs}ms.`,
        ),
      );
    }, timeoutMs);
    const inspect = () => {
      const session = store
        .getState()
        .ai.config.sessions.find((candidate) => candidate.id === sessionId);
      sawRunning ||= Boolean(session?.isRunning);
      if (session && sawRunning && !session.isRunning) {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      }
    };
    unsubscribe = store.subscribe(inspect);
    inspect();
  });
  return {
    completion,
    cancel() {
      if (settled) return;
      settled = true;
      cleanup();
      resolveCompletion();
    },
  };
}

async function cancelSessionAndWait(
  store: StoreApi<RoomState>,
  sessionId: string,
): Promise<void> {
  const ai = store.getState().ai;
  const chat = ai.getSessionChat(sessionId);
  const abortController = ai.getAbortController(sessionId);
  ai.cancelAnalysis(sessionId);
  try {
    await chat?.stop();
  } catch {
    // Cancellation errors are represented by the original eval failure.
  }
  const deadline = Date.now() + DEFAULT_TIMEOUT_MS;
  while (
    abortController &&
    store.getState().ai.getAbortController(sessionId) === abortController
  ) {
    if (Date.now() >= deadline) {
      throw new Error(`CLI eval session ${sessionId} failed to stop.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

async function resetCliEvalWorkspace(
  store: StoreApi<RoomState>,
): Promise<void> {
  const sessionIds = store
    .getState()
    .ai.config.sessions.map((session) => session.id);
  for (const sessionId of sessionIds) {
    const session = store
      .getState()
      .ai.config.sessions.find((candidate) => candidate.id === sessionId);
    if (session?.isRunning) await cancelSessionAndWait(store, sessionId);
    store.getState().artifactAi.removeAllLinksForSession(sessionId);
    store.getState().ai.deleteSession(sessionId);
  }

  const artifactIds = Object.keys(
    store.getState().artifacts.config.artifactsById,
  );
  for (const artifactId of artifactIds) {
    store.getState().artifactAi.removeAllLinksForArtifact(artifactId);
    store.getState().artifacts.deleteArtifact(artifactId);
  }

  for (const artifactId of Object.keys(
    store.getState().blockDocuments.config.artifacts,
  )) {
    store.getState().blockDocuments.removeBlockDocument(artifactId);
  }
  for (const mapId of Object.keys(store.getState().deckMaps.config.mapsById)) {
    store.getState().deckMaps.removeMap(mapId);
  }
  store.getState().artifactAi.setConfig({sessionArtifactLinks: []});

  const roomConfig = store.getState().room.config;
  store.getState().room.setConfig({...roomConfig, dataSources: []});
  await store.getState().db.destroy();
  await store.getState().db.initialize();
  await store.getState().db.refreshTableSchemas();
}

function eventsFromMessages(
  messages: readonly UIMessage[],
  startedAt: Date,
  agentProgress: Record<
    string,
    Array<{
      toolCallId: string;
      toolName: string;
      input?: unknown;
      output?: unknown;
      errorText?: string;
      state: string;
      agentToolCalls?: unknown[];
      startedAt?: number;
      completedAt?: number;
    }>
  > = {},
): RunEvidence['events'] {
  let sequence = 0;
  const events: RunEvidence['events'] = [];
  const pushAgentCalls = (
    calls: (typeof agentProgress)[string],
    parentToolCallId: string,
  ) => {
    for (const call of calls) {
      events.push({
        sequence: sequence++,
        timestamp: new Date(
          call.startedAt ?? startedAt.getTime() + sequence,
        ).toISOString(),
        type: call.agentToolCalls ? 'nested-agent' : 'tool',
        name: call.toolName,
        data: JSON.parse(
          JSON.stringify({
            toolCallId: call.toolCallId,
            parentToolCallId,
            state: call.state,
            input: call.input ?? null,
            output: call.output ?? null,
            errorText: call.errorText ?? null,
            durationMs:
              call.startedAt !== undefined && call.completedAt !== undefined
                ? Math.max(0, call.completedAt - call.startedAt)
                : null,
          }),
        ) as JsonObject,
      });
      if (call.agentToolCalls) {
        pushAgentCalls(
          call.agentToolCalls as (typeof agentProgress)[string],
          call.toolCallId,
        );
      }
    }
  };
  for (const message of messages) {
    for (const part of message.parts ?? []) {
      const timestamp = new Date(startedAt.getTime() + sequence).toISOString();
      if (part.type === 'text' && part.text) {
        events.push({
          sequence: sequence++,
          timestamp,
          type: 'model',
          data: {role: message.role, text: part.text},
        });
        continue;
      }
      if (part.type.startsWith('tool-')) {
        const name = part.type.slice('tool-'.length);
        const toolCallId = (part as {toolCallId?: unknown}).toolCallId;
        events.push({
          sequence: sequence++,
          timestamp,
          type: name === 'block_document_agent' ? 'nested-agent' : 'tool',
          name,
          data: JSON.parse(JSON.stringify(part)) as JsonObject,
        });
        if (typeof toolCallId === 'string' && agentProgress[toolCallId]) {
          pushAgentCalls(agentProgress[toolCallId], toolCallId);
        }
      }
    }
  }
  return events;
}

function createHeadlessStore(
  profile: CliCapabilityProfile,
  model: LanguageModel,
  timeoutMs: number,
  maxSteps?: number,
): {
  store: StoreApi<RoomState>;
  connector: ReturnType<typeof createNodeDuckDbConnector>;
} {
  const modelIdentity = getLanguageModelIdentity(model);
  const connector = createNodeDuckDbConnector(createCliEvalDuckDbOptions());
  const artifactTypes = createCliHeadlessArtifactTypes(profile);
  const roomStore = createStore<RoomState>()((set, get, store) => {
    const typedStore = store as StoreApi<RoomState>;
    const tools = createCliAiTools({
      store: typedStore,
      profile,
      nestedAgentModel: model,
    });
    const state = {
      ...createRoomShellSlice({
        connector,
        config: {title: 'SQLRooms Eval', dataSources: []},
        createCommandProps: {
          middleware: [artifactChatAssociationMiddleware as any],
        },
      })(set, get, store),
      ...createArtifactsSlice<RoomState>({artifactTypes})(set, get, store),
      ...createArtifactAiSlice<RoomState>({autoSync: false})(set, get, store),
      ...createDeckMapsSlice()(set, get, store),
      ...createBlockDocumentsSlice<RoomState>({
        onCreateOwnedStatefulBlock: ({
          blockInstanceId,
          blockType,
          getState,
        }) => {
          if (blockType === 'map') {
            ensureDeckMapResourceState(getState(), blockInstanceId);
          }
        },
        onDeleteOwnedStatefulBlock: ({
          blockInstanceId,
          blockType,
          getState,
        }) => {
          if (blockType === 'map')
            getState().deckMaps.removeMap(blockInstanceId);
        },
      })(set, get, store),
      dashboard: {
        initialize: async () => {
          registerCliCapabilityProfileCommands(
            typedStore,
            profile,
            artifactTypes,
          );
        },
        destroy: async () => {
          unregisterCliCapabilityProfileCommands(typedStore);
        },
        ensureDashboardArtifact: () => {},
        addDataTableExplorerForTable: () => undefined,
        getCurrentDashboardArtifactId: () => undefined,
        createDashboardArtifact: () => {
          throw new Error(
            'Dashboard capabilities are disabled for this profile.',
          );
        },
      },
      ...createAiSlice({
        tools,
        defaultProvider: modelIdentity.provider,
        defaultModel: modelIdentity.modelId,
        getCustomModel: () => model,
        getInstructions: () => createCliAiInstructions(typedStore, profile),
        getRunContext: (sessionId) =>
          getRunContext(typedStore, sessionId, {profile}),
        formatRunContextInstructions: ({runContext}) =>
          formatRunContextInstructions(runContext, typedStore),
        maxSteps,
        timeouts: {runMs: timeoutMs},
      })(set, get, store),
    };
    return state as unknown as RoomState;
  });
  return {store: roomStore, connector};
}

function fixtureWorkspaceMode(
  scenario: ScenarioDefinition,
): 'empty' | 'worksheet' | 'worksheet-chart-map' {
  const mode = scenario.fixture.workspace;
  if (
    mode === 'empty' ||
    mode === 'worksheet' ||
    mode === 'worksheet-chart-map'
  ) {
    return mode;
  }
  return 'worksheet';
}

function seedWorksheet(
  store: StoreApi<RoomState>,
  scenario: ScenarioDefinition,
  repetition: number,
  mode: 'worksheet' | 'worksheet-chart-map',
): string {
  const worksheetId = store.getState().artifacts.createArtifact({
    id: `eval-${scenario.id}-${repetition}`,
    type: 'worksheet',
    title: 'Evaluation Worksheet',
  });
  store.getState().blockDocuments.ensureBlockDocument(worksheetId);
  if (mode === 'worksheet-chart-map') {
    const mapId = `${worksheetId}-map`;
    store.getState().blockDocuments.appendBlocks(worksheetId, [
      {
        id: 'seed-heading',
        type: 'heading',
        level: 2,
        text: [{type: 'text', text: 'Existing analysis'}],
      },
      {
        id: 'seed-chart',
        type: 'chart',
        tableName: '"analytics"."events"',
        config: {
          chartType: 'bar',
          x: {field: 'category'},
          y: {field: 'metric', aggregate: 'sum'},
          title: 'Original metric chart',
        },
      },
      {
        id: 'seed-map-block',
        type: 'statefulBlock',
        blockType: 'map',
        blockInstanceId: mapId,
        ownership: 'owned',
        caption: 'Existing event map',
      },
    ]);
    store.getState().deckMaps.updateMap(mapId, {
      title: 'Existing event map',
      selectedTable: '"analytics"."events"',
      config: {
        datasets: {
          events: {source: {tableName: '"analytics"."events"'}},
        },
        spec: {
          layers: [
            {
              '@@type': 'GeoArrowScatterplotLayer',
              _sqlroomsBinding: {
                dataset: 'events',
                longitudeColumn: 'longitude',
                latitudeColumn: 'latitude',
              },
            },
          ],
        },
        fitToData: {
          dataset: 'events',
          longitudeColumn: 'longitude',
          latitudeColumn: 'latitude',
        },
      },
    });
  }
  return worksheetId;
}

/** Creates an isolated, in-process CLI eval target using production wiring. */
export function createCliEvalTarget(
  options: CliEvalTargetOptions,
): CliEvalTarget {
  const profile = resolveCliCapabilityProfile({
    profileName: 'worksheet-charts-maps',
  });
  const modelIdentity = getLanguageModelIdentity(options.model);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const {store, connector} = createHeadlessStore(
    profile,
    options.model,
    timeoutMs,
    options.maxSteps,
  );
  const now = options.now ?? (() => new Date());
  let initialized = false;
  let disposed = false;
  let runInProgress = false;

  return {
    profile,
    store,
    async initialize() {
      if (disposed)
        throw new Error('Cannot initialize a disposed CLI eval target.');
      if (initialized) return;
      await store.getState().room.initialize();
      await store.getState().db.refreshTableSchemas();
      initialized = true;
    },
    async run({scenario, oracles = [], repetition = 0}) {
      if (runInProgress) {
        throw new Error('CLI eval target already has a run in progress.');
      }
      runInProgress = true;
      try {
        if (!scenario.compatibleProfiles.includes(profile.name)) {
          throw new Error(
            `Scenario ${scenario.id} does not support profile ${profile.name}.`,
          );
        }
        await this.initialize();
        await resetCliEvalWorkspace(store);
        const startedAt = now();
        const initialState = snapshotCliEvalState(store.getState());
        let fixtureState = initialState;
        const errors: ObservedError[] = [];
        let sessionId = '';
        try {
          const workspaceMode = fixtureWorkspaceMode(scenario);
          const worksheetId =
            workspaceMode === 'empty'
              ? undefined
              : seedWorksheet(store, scenario, repetition, workspaceMode);
          fixtureState = snapshotCliEvalState(store.getState());
          if (worksheetId) {
            sessionId =
              store
                .getState()
                .artifactAi.createArtifactScopedSession(
                  scenario.title,
                  options.modelProvider ?? modelIdentity.provider,
                  options.modelId ?? modelIdentity.modelId,
                ) ?? '';
          } else {
            store
              .getState()
              .ai.createSession(
                scenario.title,
                options.modelProvider ?? modelIdentity.provider,
                options.modelId ?? modelIdentity.modelId,
              );
            sessionId = store.getState().ai.getCurrentSession()?.id ?? '';
          }
          if (!sessionId)
            throw new Error('Failed to create an eval AI session.');
          if (worksheetId) {
            store
              .getState()
              .artifactAi.addSessionArtifactLink(sessionId, worksheetId);
          }
          for (const turn of scenario.turns) {
            store.getState().ai.setPrompt(sessionId, turn.input);
            const sessionWait = waitForSession(store, sessionId, timeoutMs);
            try {
              await store.getState().ai.startAnalysis(sessionId);
            } catch (error) {
              sessionWait.cancel();
              await sessionWait.completion.catch(() => {});
              throw error;
            }
            await sessionWait.completion;
            const currentArtifactId =
              store.getState().artifacts.config.currentArtifactId;
            if (
              currentArtifactId &&
              store.getState().artifacts.config.artifactsById[currentArtifactId]
            ) {
              store
                .getState()
                .artifactAi.addSessionArtifactLink(
                  sessionId,
                  currentArtifactId,
                );
            }
          }
        } catch (error) {
          if (error instanceof CliEvalTimeoutError && sessionId) {
            await cancelSessionAndWait(store, sessionId);
          }
          errors.push(observedError(error, options.sensitiveValues ?? []));
        }

        const endedAt = now();
        const session = store
          .getState()
          .ai.config.sessions.find((candidate) => candidate.id === sessionId);
        const messages = (session?.uiMessages ?? []) as UIMessage[];
        errors.push(
          ...errorsFromMessages(messages, options.sensitiveValues ?? []),
        );
        const finalAnswer = textFromMessages(messages);
        const finalState = snapshotCliEvalState(store.getState());
        const mutations: ObservedMutation[] =
          JSON.stringify(fixtureState) === JSON.stringify(finalState)
            ? []
            : [{kind: 'workspace-state', data: {finalState}}];
        const oracleResults = await evaluateOracles(oracles, {
          scenario,
          workspace: finalState,
          database: {tables: finalState.tables},
          finalAnswer,
          errors,
          mutations,
          metadata: {initialState: fixtureState},
        });
        const summary = summarizeOracleResults(oracleResults);
        const status =
          errors.length > 0 ? 'error' : summary.pass ? 'passed' : 'failed';
        const events = eventsFromMessages(
          messages,
          startedAt,
          (session?.agentProgress ?? {}) as Parameters<
            typeof eventsFromMessages
          >[2],
        );
        for (const error of errors) {
          events.push({
            sequence: events.length,
            timestamp: endedAt.toISOString(),
            type: 'error',
            ...(error.name ? {name: error.name} : {}),
            data: {message: error.message, ...(error.metadata ?? {})},
          });
        }
        if (mutations.length > 0) {
          events.push({
            sequence: events.length,
            timestamp: endedAt.toISOString(),
            type: 'mutation',
            name: 'workspace-state',
            data: {kind: mutations[0]!.kind},
          });
        }
        const evidence = RunEvidenceSchema.parse({
          schemaVersion: RUN_EVIDENCE_SCHEMA_VERSION,
          runId: `${scenario.id}-${repetition}-${startedAt.getTime()}`,
          scenario: {id: scenario.id, version: scenario.version, repetition},
          target: {
            type: 'cli-in-process',
            profileName: profile.name,
            profileVersion: profile.version,
          },
          repository: options.repository,
          model: {
            provider: options.modelProvider ?? modelIdentity.provider,
            modelId: options.modelId ?? modelIdentity.modelId,
            ...(options.configuredRevision
              ? {configuredRevision: options.configuredRevision}
              : {}),
            ...(options.upstreamProvider
              ? {upstreamProvider: options.upstreamProvider}
              : {}),
            settings: options.modelSettings ?? {},
          },
          timing: {
            startedAt: startedAt.toISOString(),
            endedAt: endedAt.toISOString(),
            latencyMs: Math.max(0, endedAt.getTime() - startedAt.getTime()),
          },
          status,
          promptTurns: scenario.turns,
          finalAnswer,
          events,
          usage: usageFromMessages(messages),
          finalState,
          oracleResults,
          metadata: {initialState},
        });
        return redactRunEvidence(evidence, options.sensitiveValues ?? []);
      } finally {
        runInProgress = false;
      }
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      if (initialized) await store.getState().room.destroy();
      else await connector.destroy();
    },
  };
}
