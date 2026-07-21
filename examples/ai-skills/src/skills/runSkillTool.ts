import {z} from 'zod';
import {ToolLoopAgent, stepCountIs, tool, type ToolSet, type LanguageModel, type Tool} from 'ai';
import type {StoreApi} from '@sqlrooms/room-store';
import type {AiSliceState} from '@sqlrooms/ai-core';
import {streamSubAgent} from '@sqlrooms/ai-core';
import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import type {SkillStorage, SkillListing} from '@sqlrooms/ai';
import {createLoadSkillTool} from './loadSkillTool';
import {createReadFileTool} from './readFileTool';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = Tool<any, any>;

type SkillAgentRole = 'orchestrator' | 'leaf';

function getModel(store: StoreApi<AiSliceState>): LanguageModel {
  const state = store.getState();
  const currentSession = state.ai.getCurrentSession();
  const provider = currentSession?.modelProvider || 'openai';
  const modelId = currentSession?.model || 'gpt-4.1';

  return createOpenAICompatible({
    apiKey: state.ai.getApiKeyFromSettings(),
    name: provider || '',
    baseURL: state.ai.getBaseUrlFromSettings() || 'https://api.openai.com/v1',
    includeUsage: true,
  }).chatModel(modelId);
}

function buildOrchestratorInstructions(args: {
  skillName: string;
  localTables: string;
  skillList: string;
  skillInstructions: string;
}): string {
  const {skillName, localTables, skillList, skillInstructions} = args;
  return `You are a Skill Orchestrator. Your primary skill is "${skillName}".
Follow the skill instructions below to accomplish the task.

Tools available:
- runSkillAgent: Delegate execution of any skill to an isolated sub-agent. The sub-agent follows the skill instructions autonomously and returns only the result.
- loadSkill: Load another skill's full instructions into your context.
- readFile: Read a reference document from a skill directory.
- executeApi: Execute application commands (data.query, createChart, etc.).

Local tables currently available in DuckDB:
${localTables}

Strategy:
1. Read the primary skill summary below.
2. If the workflow requires another skill, use loadSkill to understand it, then delegate via runSkillAgent.
3. Execute the primary skill via runSkillAgent with context from previous steps.
4. After the primary skill completes, honor its declared cross-references/follow-ups.
5. Always use skill **id** (slug) when calling runSkillAgent or loadSkill.

CRITICAL — orchestrate, do NOT execute the skill yourself:
- The primary skill MUST be run via runSkillAgent. The skill summary below is for PLANNING only.
- executeApi is reserved for narrow COORDINATION only (e.g. a quick data.query to check a table exists).

Available skills:
${skillList}

--- Primary Skill Summary ("${skillName}") ---
${skillInstructions}`;
}

function buildLeafInstructions(args: {localTables: string; skillInstructions: string}): string {
  const {localTables, skillInstructions} = args;
  return `You are a skill execution agent. Follow the skill instructions below step by step.

Use readFile to read reference documents.
Use loadSkill to load another skill's instructions when the current skill references one.

IMPORTANT: executeApi takes a "call" field that must be a JSON OBJECT (not a string). Always pass call as a native object:
  call: { apiName: "executeCommand", args: { commandId: "data.query", input: { sqlQuery: "SELECT ..." } } }

Well-known executeApi calls:
  - executeCommand + { commandId: "data.query", input: { sqlQuery, saveToTable?, numFirstRowsToLLM? } }: Run a DuckDB SQL query. Returns { numRows, tableName?, firstRows? }.
  - createChart + { sqlQuery, vegaLiteSpec, reasoning? }: Validate AND RENDER a Vega-Lite chart. sqlQuery supplies the data; vegaLiteSpec is a STRINGIFIED Vega-Lite spec with the "data" field OMITTED. Returns { details }.

CRITICAL — to display any chart you MUST call executeApi with apiName "createChart". This is the ONLY way a chart is rendered to the user.
  - Do NOT write the Vega-Lite spec into your text answer as JSON — that renders nothing.
  - Do NOT put "data", "datasets", or inline "values" in vegaLiteSpec — the sqlQuery supplies the data at render time.
  - Example:
      call: { apiName: "createChart", args: {
        sqlQuery: "SELECT MagType, COUNT(*) AS cnt FROM sample_locations GROUP BY MagType",
        vegaLiteSpec: "{\\"mark\\":\\"bar\\",\\"encoding\\":{\\"x\\":{\\"field\\":\\"MagType\\",\\"type\\":\\"nominal\\"},\\"y\\":{\\"field\\":\\"cnt\\",\\"type\\":\\"quantitative\\"}},\\"width\\":\\"container\\"}",
        reasoning: "Bar chart of earthquake counts by MagType"
      } }
  FALSIFIABLE CHECK: if the skill's goal was a chart and you did not make a successful createChart call, you erred — call createChart before finishing.

When you are done, provide a concise summary of what was accomplished (tables created, row counts, charts created). Do NOT paste the full Vega-Lite spec into the summary.

Local tables currently available in DuckDB:
${localTables}

${skillInstructions}`;
}

/**
 * Creates the runSkill tool (orchestrator or leaf role). The orchestrator
 * can delegate to leaf sub-agents; the leaf executes a skill step-by-step.
 */
export function createRunSkillTool(
  storage: SkillStorage,
  store: StoreApi<AiSliceState>,
  executeApiTool: AnyTool,
  templateVars: Record<string, string> = {},
  getLocalTables: () => string = () => '(none loaded)',
) {
  function buildTool(role: SkillAgentRole) {
    const description =
      role === 'orchestrator'
        ? 'Execute a skill as a sub-agent. The skill agent handles the entire workflow autonomously and returns only the final result.'
        : 'Execute a skill as an isolated sub-agent that follows the skill instructions step by step.';

    return tool({
      description,
      inputSchema: z.object({
        skillName: z.string().describe('The skill ID (slug) to execute'),
        prompt: z.string().describe("The user's original prompt / what to accomplish"),
        reasoning: z.string().describe('Why this skill is being used'),
      }),
      execute: async ({skillName, prompt}, options) => {
        const ref = await storage.resolveSkillId(skillName);
        if (!ref) {
          return {success: false, error: `Skill not found: ${skillName}`};
        }

        try {
          const record = await storage.readSkill(ref);
          let skillInstructions = record.instructions;
          for (const [key, val] of Object.entries(templateVars)) {
            skillInstructions = skillInstructions.replaceAll(`{{${key}}}`, val);
          }

          const localTables = getLocalTables();

          let listings: SkillListing[] = [];
          if (role === 'orchestrator') {
            listings = await storage.listSkills();
          }

          const tools: ToolSet = {
            ...(role === 'orchestrator'
              ? {runSkillAgent: buildTool('leaf')}
              : {}),
            loadSkill: createLoadSkillTool(storage, templateVars),
            readFile: createReadFileTool(storage),
            executeApi: executeApiTool,
          };

          const systemInstructions =
            role === 'orchestrator'
              ? buildOrchestratorInstructions({
                  skillName,
                  localTables,
                  skillList: listings
                    .map((l) => `- ${l.ref.id} (${l.manifest.name}): ${l.manifest.description}`)
                    .join('\n'),
                  skillInstructions,
                })
              : buildLeafInstructions({localTables, skillInstructions});

          const agent = new ToolLoopAgent({
            model: getModel(store),
            tools,
            instructions: systemInstructions,
            stopWhen: stepCountIs(15),
          });

          const result = await streamSubAgent(
            agent,
            prompt,
            store,
            options?.toolCallId || '',
            options?.abortSignal,
          );

          return {success: true, details: result.finalOutput};
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            return {success: false, error: 'Skill execution was cancelled.'};
          }
          console.error(`[runSkill:${skillName}] Skill execution failed:`, error);
          return {
            success: false,
            error: `Skill execution failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
      toModelOutput: ({output}) => ({
        type: 'text' as const,
        value: JSON.stringify({
          success: output.success,
          details: output.details || output.error,
        }),
      }),
    });
  }

  return buildTool('orchestrator');
}
