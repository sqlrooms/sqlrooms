Zod schemas and default config helpers for SQLRooms AI slices.

Use this package to validate persisted AI state and to bootstrap AI/AI-settings configuration safely.

## Installation

```bash
npm install @sqlrooms/ai-config
```

## Exports

- `AiSliceConfig`
- `AiSessionForkOrigin`
- `createDefaultAiConfig()`
- `AiSettingsSliceConfig`
- `ChatSessionSchema`, `ErrorMessageSchema`
- Compatibility exports: `AnalysisSessionSchema`, `AnalysisResultSchema`
- `ToolUIPart`, `UIMessagePart` types

`ChatSessionSchema` accepts legacy persisted sessions that still contain
`analysisResults`, but parsed/new session state no longer includes that field.
Use `uiMessages` for current chat state.

`AiSliceConfig.sessionForks` stores optional chat-session fork provenance keyed
by target session id. Fork metadata uses chat/message terminology and keeps
legacy analysis-result ids only as compatibility fields when needed.

`ChatSessionSchema.agentProgress` stores persisted sub-agent tool-call trees
keyed by the parent tool call id. `ChatSessionSchema.agentSnapshots` optionally
stores persisted devtools metadata for those agent calls, such as available tool
names, descriptions, capability flags, approval hints, and bounded settings.
Snapshots are intended for debugging and should not contain executable tools,
closures, secrets, or unbounded prompt/output content.

## Basic usage

### Validate and load AI session config

```ts
import {AiSliceConfig, createDefaultAiConfig} from '@sqlrooms/ai-config';

const raw = localStorage.getItem('my-ai-config');

const aiConfig = raw
  ? AiSliceConfig.parse(JSON.parse(raw))
  : createDefaultAiConfig();
```

### Validate provider/model settings config

```ts
import {AiSettingsSliceConfig} from '@sqlrooms/ai-config';

const rawSettings = {
  providers: {
    openai: {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      models: [{modelName: 'gpt-4.1'}],
    },
  },
  customModels: [],
  modelParameters: {
    maxSteps: 30,
    additionalInstruction: '',
  },
};

const aiSettings = AiSettingsSliceConfig.parse(rawSettings);
```

## Using with `persistSliceConfigs`

```ts
import {AiSettingsSliceConfig, AiSliceConfig} from '@sqlrooms/ai-config';
import {createRoomStore, persistSliceConfigs} from '@sqlrooms/room-shell';

const persistence = {
  name: 'my-app-storage',
  sliceConfigSchemas: {
    ai: AiSliceConfig,
    aiSettings: AiSettingsSliceConfig,
  },
};

createRoomStore(
  persistSliceConfigs(persistence, (set, get, store) => ({
    // ...your slices here
  })),
);
```

## Related packages

- `@sqlrooms/ai-core` for core AI slice logic
- `@sqlrooms/ai-settings` for provider/model settings UI + state
- `@sqlrooms/ai` for higher-level AI package integration

## Host-owned harness runs

`HarnessRunEvent`, `HarnessRun`, `HarnessCapabilities`, `HarnessStartTurn`,
`HarnessApprovalDecision` and `HarnessConversationSnapshot` are Zod-only v1
contracts shared by hosts and browser runtimes. Event sequences are workspace-wide;
clients snapshot then subscribe after `lastSeq`, deduplicating by sequence.
Unknown event kinds render generically. Large payloads use a host-authorized
`blobRef`; previews are never replay events. Attachments and live input are not
supported by the initial adapter. Restarted work is `interrupted`, never inferred
successful from model output. Approval decisions require an explicit owner.

[Recorded Codex and Claude fixtures](fixtures/harness-v1/README.md) cover short
answers, multi-tool artifact creation, approvals, cancellation, restart
interruption, and unknown native events through the shared replay runtime.

Harness run records may include an optional `harness` identifier. Hosts should
persist the selected adapter for new runs; older v1 records without it remain
valid. Capability flags describe that adapter's supported operations.
