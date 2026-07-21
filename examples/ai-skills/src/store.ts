import {
  AiSliceConfig,
  AiSliceState,
  AiSettingsSliceConfig,
  AiSettingsSliceState,
  createAiSettingsSlice,
  createAiSlice,
} from '@sqlrooms/ai';
import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  persistSliceConfigs,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {z} from 'zod';
import {AI_SETTINGS} from './config';
import {
  skillStorage,
  createDiscoverSkillTool,
  createRunSkillTool,
  createExecuteApiTool,
  ExecuteApiToolRenderer,
} from './skills';
import {BUNDLED_SKILLS} from './skills/bundledSkills';

export const RoomPanelTypes = z.enum(['main'] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

export type RoomState = RoomShellSliceState &
  AiSliceState &
  AiSettingsSliceState;

function buildSkillsPrompt(): string {
  if (BUNDLED_SKILLS.length === 0) return '';
  const lines = BUNDLED_SKILLS.map(
    (s) => `- ${s.manifest.id}: ${s.manifest.description}`,
  );
  return `\n\nAvailable skills (use discoverSkill to list, runSkill to execute):\n${lines.join('\n')}`;
}

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persistSliceConfigs<RoomState>(
    {
      name: 'ai-skills-example-app-state-storage',
      sliceConfigSchemas: {
        room: BaseRoomConfig,
        layout: LayoutConfig,
        ai: AiSliceConfig,
        aiSettings: AiSettingsSliceConfig,
      },
    },
    (set, get, store) => ({
      ...createRoomShellSlice({
        config: {
          dataSources: [
            {
              tableName: 'sample_locations',
              type: 'url',
              url: 'https://raw.githubusercontent.com/keplergl/kepler.gl-data/refs/heads/master/earthquakes/data.csv',
            },
          ],
        },
        layout: {
          config: {
            id: 'root',
            type: 'panel',
            panel: RoomPanelTypes.enum.main,
          } satisfies LayoutConfig,
          panels: {
            [RoomPanelTypes.enum.main]: {
              title: 'Main',
              icon: () => null,
              component: () => null,
            },
          },
        },
      })(set, get, store),

      ...createAiSettingsSlice({config: AI_SETTINGS})(set, get, store),

      ...createAiSlice({
        getInstructions: () => {
          const tables = store.getState().db.tables;
          const tableList =
            tables.length > 0
              ? tables
                  .map(
                    (t) =>
                      `- ${t.tableName} (${t.columns.map((c) => `${c.name}: ${c.type}`).join(', ')})`,
                  )
                  .join('\n')
              : '(none loaded yet)';

          return `You are an AI data analysis assistant with access to skills for charting data.

Available DuckDB tables:
${tableList}

You have two tools:
- discoverSkill: List available skills with their descriptions.
- runSkill: Execute a skill by name. The skill runs as a sub-agent with its own tools.

When the user asks for a chart or other data visualization, discover the appropriate skill and run it.
${buildSkillsPrompt()}`;
        },

        tools: {
          discoverSkill: createDiscoverSkillTool(skillStorage),
          runSkill: createRunSkillTool(
            skillStorage,
            store,
            createExecuteApiTool(store),
            {},
            () => {
              const tables = store.getState().db.tables;
              if (tables.length === 0) return '(none loaded yet)';
              return tables
                .map(
                  (t) =>
                    `- ${t.tableName} (${t.columns.map((c) => `${c.name}: ${c.type}`).join(', ')})`,
                )
                .join('\n');
            },
          ),
        },

        toolRenderers: {
          // `executeApi` runs inside skill sub-agents (see createRunSkillTool).
          // Registering its renderer here — and hoisting the `executeApi` name
          // in MainView — promotes charts created by `createChart` out of the
          // nested activity log and renders them at the conversation level.
          executeApi: ExecuteApiToolRenderer,
        },
      })(set, get, store),
    }),
  ),
);
