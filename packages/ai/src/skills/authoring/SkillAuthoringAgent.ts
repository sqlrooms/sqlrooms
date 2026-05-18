import {ToolLoopAgent, stepCountIs, type LanguageModel} from 'ai';
import type {SkillAuthoringContext} from './SkillAuthoringContext';
import {buildSkillAuthoringSystemPrompt} from './systemPrompt';
import {
  createSaveSkillTool,
  createWriteInstructionsTool,
  createWriteManifestTool,
  type SaveSkillCallback,
} from './tools';
import type {SkillDraftStore} from './createSkillDraftStore';

/**
 * Default step budget for the authoring loop. Generous because the agent may
 * iterate on both the manifest and the instructions before the user confirms
 * a save.
 */
export const DEFAULT_SKILL_AUTHORING_STOP_STEPS = 20;

/** Tool name constants for the skill authoring agent. */
export const SKILL_AUTHORING_TOOL_NAMES = {
  writeManifest: 'writeManifest',
  writeInstructions: 'writeInstructions',
  saveSkill: 'saveSkill',
} as const;

export interface CreateSkillAuthoringAgentOptions {
  /**
   * Fully constructed language model. The factory does not handle credentials
   * or provider selection — the host passes the model ready to use.
   */
  model: LanguageModel;
  /** Host-supplied capability surface. */
  context: SkillAuthoringContext;
  /** Per-session draft store (see `createSkillDraftStore`). */
  draftStore: SkillDraftStore;
  /** Callback invoked by the `saveSkill` tool. */
  onSave: SaveSkillCallback;
  /** Maximum tool-loop steps. Defaults to `DEFAULT_SKILL_AUTHORING_STOP_STEPS`. */
  stopSteps?: number;
  /** Sampling temperature. Defaults to `0.2` for focused scaffolding output. */
  temperature?: number;
}

/**
 * Build a `ToolLoopAgent` configured with the three authoring tools
 * (`writeManifest`, `writeInstructions`, `saveSkill`) and a system prompt
 * derived from `context`.
 */
export function createSkillAuthoringAgent({
  model,
  context,
  draftStore,
  onSave,
  stopSteps = DEFAULT_SKILL_AUTHORING_STOP_STEPS,
  temperature = 0.2,
}: CreateSkillAuthoringAgentOptions) {
  const tools = {
    writeManifest: createWriteManifestTool(draftStore, context),
    writeInstructions: createWriteInstructionsTool(draftStore, context),
    saveSkill: createSaveSkillTool(draftStore, context, onSave),
  };

  return new ToolLoopAgent({
    model,
    tools,
    instructions: buildSkillAuthoringSystemPrompt(context),
    stopWhen: stepCountIs(stopSteps),
    temperature,
  });
}
