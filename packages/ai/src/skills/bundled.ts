import {SkillNotFoundError, SkillRootReadOnlyError} from './errors';
import type {SkillManifest} from './manifest';
import type {
  SkillFile,
  SkillListing,
  SkillRecord,
  SkillRef,
  SkillRoot,
  SkillStorage,
  SkillWriteContent,
} from './storage';

/**
 * Definition for a skill bundled directly into package or app source.
 */
export type BundledSkillDefinition = {
  /** Skill id within the bundled root. */
  id: string;
  /** Parsed skill manifest. */
  manifest: SkillManifest;
  /** Markdown instructions shown to an agent when the skill is selected. */
  instructions: string;
  /** Optional files that conceptually live alongside `SKILL.md`. */
  extraFiles?: SkillFile[];
};

/**
 * Read-only `SkillStorage` for skills shipped with a package or app bundle.
 *
 * Hosts can combine multiple bundled roots with user/workspace roots via
 * `CompositeSkillStorage` while preserving root ids in listings and traces.
 */
export class BundledSkillStorage implements SkillStorage {
  private readonly skillsById: ReadonlyMap<string, BundledSkillDefinition>;

  constructor(
    private readonly root: SkillRoot,
    skills: ReadonlyArray<BundledSkillDefinition>,
  ) {
    this.skillsById = new Map(skills.map((skill) => [skill.id, skill]));
  }

  async listRoots(): Promise<SkillRoot[]> {
    return [{...this.root, writable: false}];
  }

  async listSkills(rootId?: string): Promise<SkillListing[]> {
    if (rootId !== undefined && rootId !== this.root.id) return [];
    return [...this.skillsById.values()].map((skill) => ({
      ref: {rootId: this.root.id, id: skill.id},
      manifest: skill.manifest,
    }));
  }

  async readSkill(ref: SkillRef): Promise<SkillRecord> {
    if (ref.rootId !== this.root.id) {
      throw new SkillNotFoundError(
        `Unknown bundled skill root "${ref.rootId}"`,
        {
          ref,
        },
      );
    }

    const skill = this.skillsById.get(ref.id);
    if (!skill) {
      throw new SkillNotFoundError(`Unknown bundled skill "${ref.id}"`, {ref});
    }

    return {
      ref,
      manifest: skill.manifest,
      instructions: skill.instructions,
      extraFiles: skill.extraFiles ?? [],
    };
  }

  async writeSkill(
    rootId: string,
    id: string,
    _content: SkillWriteContent,
  ): Promise<SkillRef> {
    throw new SkillRootReadOnlyError(
      `Bundled skill root "${rootId}" is read-only`,
      {rootId, extras: {id}},
    );
  }

  async deleteSkill(ref: SkillRef): Promise<void> {
    throw new SkillRootReadOnlyError(
      `Bundled skill root "${ref.rootId}" is read-only`,
      {ref},
    );
  }

  async resolveSkillId(id: string): Promise<SkillRef | null> {
    return this.skillsById.has(id) ? {rootId: this.root.id, id} : null;
  }
}
