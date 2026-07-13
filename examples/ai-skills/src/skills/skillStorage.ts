import type {
  SkillStorage,
  SkillRoot,
  SkillRef,
  SkillRecord,
  SkillListing,
  SkillWriteContent,
} from '@sqlrooms/ai';
import {SkillNotFoundError, SkillRootReadOnlyError} from '@sqlrooms/ai';
import {BUNDLED_SKILLS} from './bundledSkills';

const BUILT_IN_ROOT_ID = 'built-in';

const BUILT_IN_ROOT: SkillRoot = {
  id: BUILT_IN_ROOT_ID,
  label: 'Built-in',
  writable: false,
};

/**
 * Readonly SkillStorage over BUNDLED_SKILLS (the codegen output of
 * scripts/generate-skills.ts).
 */
export class BundledSkillStorage implements SkillStorage {
  private readonly records: ReadonlyArray<SkillRecord>;
  private readonly byId: ReadonlyMap<string, SkillRecord>;

  constructor(records: ReadonlyArray<SkillRecord> = BUNDLED_SKILLS) {
    this.records = records;
    this.byId = new Map(records.map((r) => [r.manifest.id, r]));
  }

  async listRoots(): Promise<SkillRoot[]> {
    return [BUILT_IN_ROOT];
  }

  async listSkills(rootId?: string): Promise<SkillListing[]> {
    if (rootId !== undefined && rootId !== BUILT_IN_ROOT_ID) return [];
    return this.records.map((r) => ({ref: r.ref, manifest: r.manifest}));
  }

  async readSkill(ref: SkillRef): Promise<SkillRecord> {
    const found =
      ref.rootId === BUILT_IN_ROOT_ID ? this.byId.get(ref.id) : undefined;
    if (!found) {
      throw new SkillNotFoundError(
        `BundledSkillStorage: skill not found: ${ref.rootId}/${ref.id}`,
        {ref},
      );
    }
    return found;
  }

  async writeSkill(
    rootId: string,
    _id: string,
    _content: SkillWriteContent,
  ): Promise<SkillRef> {
    throw new SkillRootReadOnlyError(`Root "${rootId}" is read-only`, {
      rootId,
    });
  }

  async deleteSkill(ref: SkillRef): Promise<void> {
    throw new SkillRootReadOnlyError(`Root "${ref.rootId}" is read-only`, {
      rootId: ref.rootId,
      ref,
    });
  }

  async resolveSkillId(id: string): Promise<SkillRef | null> {
    const found = this.byId.get(id);
    return found ? found.ref : null;
  }
}

export const skillStorage = new BundledSkillStorage();
