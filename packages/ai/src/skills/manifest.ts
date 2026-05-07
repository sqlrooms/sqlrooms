import {parse as parseYaml, stringify as stringifyYaml} from 'yaml';
import {z} from 'zod';
import {SkillManifestError} from './errors';

/**
 * A file belonging to a skill directory, addressed by its path relative to
 * the skill's root folder.
 */
export interface SkillFile {
  relativePath: string;
  content: string;
}

/**
 * Kebab-case identifier: lowercase letters, digits, and single hyphens.
 * Must start and end with an alphanumeric character.
 */
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Simple semver: MAJOR.MINOR.PATCH with optional pre-release / build suffix.
 * Not a full spec parser — sufficient to reject obvious malformed versions.
 */
const SEMVER = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

export const SkillManifestSchema = z.object({
  id: z.string().min(1).regex(KEBAB_CASE, {
    message: 'id must be kebab-case (e.g. "my-skill-name")',
  }),
  version: z.string().regex(SEMVER, {
    message: 'version must be semver (e.g. "0.1.0")',
  }),
  name: z.string().trim().min(1, {message: 'name must not be empty'}),
  description: z
    .string()
    .trim()
    .min(1, {message: 'description must not be empty'}),
  author: z.string().optional(),
  icon: z.string().optional(),
});

export type SkillManifest = z.infer<typeof SkillManifestSchema>;

/**
 * Parse YAML text into a validated `SkillManifest`.
 *
 * @throws {SkillManifestError} if the YAML is malformed or the parsed value
 * fails schema validation.
 */
export function parseSkillManifest(yamlText: string): SkillManifest {
  let raw: unknown;
  try {
    raw = parseYaml(yamlText);
  } catch (err) {
    throw new SkillManifestError(
      `Failed to parse skill.yaml: ${(err as Error).message}`,
    );
  }
  const result = SkillManifestSchema.safeParse(raw);
  if (!result.success) {
    throw new SkillManifestError('skill.yaml failed schema validation', {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.map((segment) =>
          typeof segment === 'symbol' ? segment.toString() : segment,
        ),
        message: issue.message,
        code: issue.code,
      })),
    });
  }
  return result.data;
}

/**
 * Serialize a manifest to YAML with a stable field order so that round-trips
 * produce diff-friendly output.
 */
export function serializeSkillManifest(manifest: SkillManifest): string {
  const ordered: Record<string, unknown> = {
    id: manifest.id,
    version: manifest.version,
    name: manifest.name,
    description: manifest.description,
  };
  if (manifest.author !== undefined) ordered.author = manifest.author;
  if (manifest.icon !== undefined) ordered.icon = manifest.icon;
  return stringifyYaml(ordered, {lineWidth: 0});
}

/**
 * Compose a skill's two canonical files (`skill.yaml` + `SKILL.md`) plus any
 * additional files into a validated record.
 *
 * @throws {SkillManifestError} if `skill.yaml` or `SKILL.md` is missing or
 * empty, or if the manifest fails validation.
 */
export function loadSkillFromFiles(files: SkillFile[]): {
  manifest: SkillManifest;
  instructions: string;
  extraFiles: SkillFile[];
} {
  let manifestFile: SkillFile | undefined;
  let instructionsFile: SkillFile | undefined;
  const extraFiles: SkillFile[] = [];

  for (const file of files) {
    if (file.relativePath === 'skill.yaml') {
      manifestFile = file;
    } else if (file.relativePath === 'SKILL.md') {
      instructionsFile = file;
    } else {
      extraFiles.push(file);
    }
  }

  if (!manifestFile) {
    throw new SkillManifestError('Missing skill.yaml');
  }
  if (!instructionsFile) {
    throw new SkillManifestError('Missing SKILL.md');
  }
  if (instructionsFile.content.trim().length === 0) {
    throw new SkillManifestError('SKILL.md must not be empty');
  }
  const manifest = parseSkillManifest(manifestFile.content);
  return {manifest, instructions: instructionsFile.content, extraFiles};
}
