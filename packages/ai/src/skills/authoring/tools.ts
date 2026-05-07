import {tool} from 'ai';
import {z} from 'zod';
import type {SkillRef} from '../storage';
import type {SkillAuthoringContext} from './SkillAuthoringContext';
import type {SkillDraft, SkillDraftStore} from './createSkillDraftStore';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Pre-compile word-boundary patterns for a list of forbidden identifiers.
 * Returns an array of `[identifier, RegExp]` pairs, skipping empty strings.
 */
function buildForbiddenPatterns(
  identifiers: readonly string[] | undefined,
): Array<[string, RegExp]> {
  if (!identifiers || identifiers.length === 0) return [];
  return identifiers
    .filter((id) => id.length > 0)
    .map((id) => [id, new RegExp(`\\b${escapeRegExp(id)}\\b`, 'i')]);
}

/**
 * Return the first identifier in `patterns` that appears in `text` as a
 * whole word (case-insensitive), or `null` if none do.
 */
export function containsForbidden(
  text: string,
  patterns: Array<[string, RegExp]>,
): string | null {
  for (const [id, pattern] of patterns) {
    if (pattern.test(text)) return id;
  }
  return null;
}

function portabilityErrorMessage(match: string): string {
  return (
    `"${match}" looks like a concrete table or column name — skills must be ` +
    `portable templates. Rewrite abstractly (refer to "the input table" or ` +
    `"the target column" instead).`
  );
}

/**
 * Run the forbidden-identifier check against `text` and return an error
 * result if a match is found, otherwise `null`.
 */
function checkForbidden(
  text: string,
  patterns: Array<[string, RegExp]>,
): {success: false; error: string} | null {
  const match = containsForbidden(text, patterns);
  if (match !== null) {
    return {success: false as const, error: portabilityErrorMessage(match)};
  }
  return null;
}

/**
 * Callback invoked by `saveSkill` after the draft has been validated. The
 * host owns id derivation, version assignment, and the actual write through
 * `SkillStorage`.
 */
export type SaveSkillCallback = (
  draft: SkillDraft,
  rootId?: string,
) => Promise<SkillRef>;

// ---------------------------------------------------------------------------
// writeManifest

const WriteManifestInput = z.object({
  name: z.string().trim().min(1, {message: 'name must not be empty'}),
  description: z
    .string()
    .trim()
    .min(1, {message: 'description must not be empty'}),
  author: z.string().optional(),
});

export function createWriteManifestTool(
  draftStore: SkillDraftStore,
  context: SkillAuthoringContext,
) {
  const forbiddenPatterns = buildForbiddenPatterns(
    context.forbiddenIdentifiers,
  );

  return tool({
    description:
      'Draft or revise the skill manifest (name, description, optional author). Call this first when authoring a new skill.',
    inputSchema: WriteManifestInput,
    execute: async ({name, description, author}) => {
      const combined = `${name}\n${description}\n${author ?? ''}`;
      const forbidden = checkForbidden(combined, forbiddenPatterns);
      if (forbidden !== null) return forbidden;
      draftStore.getState().patchManifest({name, description, author});
      return {
        success: true as const,
        manifest: {name, description, author},
      };
    },
  });
}

// ---------------------------------------------------------------------------
// writeInstructions

const WriteInstructionsInput = z.object({
  markdown: z.string().min(1, {message: 'markdown must not be empty'}),
});

export function createWriteInstructionsTool(
  draftStore: SkillDraftStore,
  context: SkillAuthoringContext,
) {
  const forbiddenPatterns = buildForbiddenPatterns(
    context.forbiddenIdentifiers,
  );

  return tool({
    description:
      'Replace the full SKILL.md body with the given markdown. Call after writeManifest.',
    inputSchema: WriteInstructionsInput,
    execute: async ({markdown}) => {
      const forbidden = checkForbidden(markdown, forbiddenPatterns);
      if (forbidden !== null) return forbidden;
      draftStore.getState().setInstructions(markdown);
      return {success: true as const, length: markdown.length};
    },
  });
}

// ---------------------------------------------------------------------------
// saveSkill

const SaveSkillInput = z.object({
  rootId: z.string().optional(),
});

export function createSaveSkillTool(
  draftStore: SkillDraftStore,
  context: SkillAuthoringContext,
  onSave: SaveSkillCallback,
) {
  return tool({
    description:
      'Persist the current draft via the host. Only call after the user has explicitly confirmed they are ready to save.',
    inputSchema: SaveSkillInput,
    execute: async ({rootId}) => {
      const state = draftStore.getState();
      const missing: string[] = [];
      if (!state.name.trim()) missing.push('name');
      if (!state.description.trim()) missing.push('description');
      if (!state.instructions.trim()) missing.push('instructions');
      if (missing.length > 0) {
        return {
          success: false as const,
          error: `Cannot save: missing ${missing.join(', ')}. Fill these in before saving.`,
        };
      }
      const targetRoot = rootId ?? context.defaultRootId;
      const draft: SkillDraft = {
        name: state.name,
        description: state.description,
        author: state.author,
        instructions: state.instructions,
      };
      state.setStatus('saving');
      try {
        const ref = await onSave(draft, targetRoot);
        draftStore.getState().setStatus('saved');
        return {success: true as const, ref};
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        draftStore.getState().setStatus('error', message);
        return {success: false as const, error: message};
      }
    },
  });
}
