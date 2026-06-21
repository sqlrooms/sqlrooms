import type {SkillListing} from '@sqlrooms/ai';

/**
 * Render the installed skills catalog as a short markdown block for the
 * orchestrator's system prompt. Kept local to the example because the exact
 * format tends to drift per host (tone, section headers, which metadata to
 * surface). Copy this into your app and adapt it.
 */
export function buildSkillsPromptFromListings(
  listings: readonly SkillListing[],
): string {
  if (listings.length === 0) return '';
  const lines = listings.map(({ref, manifest}) => {
    const rootTag = ref.rootId === 'built-in' ? '' : ` (${ref.rootId})`;
    return `- \`${manifest.id}\`${rootTag} — ${manifest.description}`;
  });
  return [
    '## Installed skills',
    '',
    'Call `runSkill({skillId, goal})` when one of these looks like it fits',
    "the user's request. Otherwise answer directly.",
    '',
    ...lines,
  ].join('\n');
}
