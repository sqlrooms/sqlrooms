# @sqlrooms/ai-config

Zod schemas and default config helpers for SQLRooms AI slices.

Use this package to validate persisted AI state and to bootstrap AI/AI-settings configuration safely.

## Installation

```bash
npm install @sqlrooms/ai-config
```

## Exports

- `AiSliceConfig`
- `createDefaultAiConfig()`
- `AiSettingsSliceConfig`
- `AnalysisSessionSchema`, `AnalysisResultSchema`, `ErrorMessageSchema`
- `ToolUIPart`, `UIMessagePart` types

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
