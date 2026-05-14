import {AiSliceConfig, AiSliceState, createAiSlice} from '@sqlrooms/ai-core';
import {
  AiSettingsSliceConfig,
  AiSettingsSliceState,
  createAiSettingsSlice,
} from '@sqlrooms/ai-settings';
import {
  createBaseRoomSlice,
  createRoomStore,
  BaseRoomStoreState,
  persistSliceConfigs,
} from '@sqlrooms/room-store';
import {AI_SETTINGS} from './config';
import {weatherAgentTool} from './agents/WeatherAgent';
import {InMemorySkillStorage} from './skills/InMemorySkillStorage';
import {createRunSkillTool} from './skills/runSkillTool';
import {getModel} from './skills/getModel';
import {buildSkillsPromptFromListings} from './skills/skillPrompt';
import type {SkillListing} from '@sqlrooms/ai';

type State = BaseRoomStoreState & AiSliceState & AiSettingsSliceState;

/**
 * Singleton storage for the example. Lives for the page's lifetime.
 * Exported so the authoring wizard and skills UI can reach it directly.
 */
export const skillStorage = new InMemorySkillStorage();

/**
 * Cached listings used when building the orchestrator's system prompt.
 * Kept outside the store so the prompt read path stays synchronous; the
 * cache is refreshed whenever storage mutates.
 */
let cachedListings: SkillListing[] = [];

let refreshSeq = 0;
async function refreshSkillListings() {
  const seq = ++refreshSeq;
  try {
    const next = await skillStorage.listSkills();
    if (seq === refreshSeq) cachedListings = next;
  } catch (err) {
    console.error('[store] Failed to refresh skill listings:', err);
  }
}

// Initial seed — fire-and-forget is safe, the storage constructor already
// populated the built-in root synchronously.
void refreshSkillListings();
skillStorage.subscribe(() => {
  void refreshSkillListings();
});

/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomStore<State>(
  persistSliceConfigs(
    {
      name: 'ai-agent-example-app-state-storage',
      sliceConfigSchemas: {
        ai: AiSliceConfig,
        aiSettings: AiSettingsSliceConfig,
      },
    },
    (set, get, store) => ({
      // Base room slice
      ...createBaseRoomSlice()(set, get, store),

      // Ai model config slice
      ...createAiSettingsSlice({config: AI_SETTINGS})(set, get, store),

      // Ai slice
      ...createAiSlice({
        getInstructions: () => {
          const skillsBlock = buildSkillsPromptFromListings(cachedListings);
          return [
            'You are an AI assistant that can answer questions and help with tasks.',
            skillsBlock,
          ]
            .filter(Boolean)
            .join('\n\n');
        },

        tools: {
          'agent-weather': weatherAgentTool(store),
          runSkill: createRunSkillTool({
            store,
            storage: skillStorage,
            getModel: () => getModel(store),
          }),
        },
      })(set, get, store),
    }),
  ),
);
