AI provider/model settings state and UI components for SQLRooms.

This package gives you:

- `createAiSettingsSlice()` to manage providers, models, custom models, and model parameters
- settings UI components (`AiSettingsPanel`, `AiProvidersSettings`, `AiModelsSettings`, etc.)
- a typed hook `useStoreWithAiSettings()` for settings actions/selectors

## Installation

```bash
npm install @sqlrooms/ai-settings @sqlrooms/ai-core @sqlrooms/room-store @sqlrooms/ui
```

## Basic store setup

```tsx
import {AiSliceState, createAiSlice} from '@sqlrooms/ai-core';
import {
  AiSettingsSliceState,
  createAiSettingsSlice,
} from '@sqlrooms/ai-settings';
import {
  BaseRoomStoreState,
  createBaseRoomSlice,
  createRoomStore,
} from '@sqlrooms/room-store';

type State = BaseRoomStoreState & AiSliceState & AiSettingsSliceState;

export const {roomStore, useRoomStore} = createRoomStore<State>(
  (set, get, store) => ({
    ...createBaseRoomSlice()(set, get, store),
    ...createAiSettingsSlice({
      config: {
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
      },
    })(set, get, store),
    ...createAiSlice({
      getInstructions: () => 'You are a data analytics assistant.',
    })(set, get, store),
  }),
);
```

## Render the settings UI

```tsx
import {AiSettingsPanel} from '@sqlrooms/ai-settings';
import {Button, useDisclosure} from '@sqlrooms/ui';

export function SettingsView() {
  const disclosure = useDisclosure();

  return (
    <>
      <Button onClick={disclosure.onOpen}>AI Settings</Button>
      <AiSettingsPanel disclosure={disclosure}>
        <AiSettingsPanel.ProvidersSettings />
        <AiSettingsPanel.ModelsSettings />
        <AiSettingsPanel.ModelParametersSettings />
      </AiSettingsPanel>
    </>
  );
}
```

## Update settings programmatically

```tsx
import {useStoreWithAiSettings} from '@sqlrooms/ai-settings';

function MaxStepsControl() {
  const maxSteps = useStoreWithAiSettings(
    (state) => state.aiSettings.config.modelParameters.maxSteps,
  );
  const setMaxSteps = useStoreWithAiSettings(
    (state) => state.aiSettings.setMaxSteps,
  );

  return (
    <button onClick={() => setMaxSteps(maxSteps + 5)}>
      Increase max steps ({maxSteps})
    </button>
  );
}
```

## Notes

- `AiModelsSettings` integrates with AI session state from `@sqlrooms/ai-core`.
- `AiSettingsSliceConfig` is re-exported from `@sqlrooms/ai-config` for persistence and validation.
