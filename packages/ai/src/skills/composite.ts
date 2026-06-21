import {SkillNotFoundError} from './errors';
import type {
  SkillListing,
  SkillRecord,
  SkillRef,
  SkillRoot,
  SkillStorage,
  SkillWriteContent,
} from './storage';

/**
 * A `SkillStorage` that priority-merges an ordered array of children
 * (highest priority first). Children must own disjoint `rootId`s — the
 * composite does not validate this; violating it makes dispatch ambiguous.
 */
export class CompositeSkillStorage implements SkillStorage {
  constructor(private readonly children: ReadonlyArray<SkillStorage>) {}

  async listRoots(): Promise<SkillRoot[]> {
    const out: SkillRoot[] = [];
    for (const child of this.children) {
      const roots = await child.listRoots();
      out.push(...roots);
    }
    return out;
  }

  async listSkills(rootId?: string): Promise<SkillListing[]> {
    if (rootId !== undefined) {
      const child = await this.findChildForRoot(rootId);
      return child ? child.listSkills(rootId) : [];
    }
    // Duplicates (same id in multiple roots) are intentionally included so
    // callers can render conflict indicators.
    const out: SkillListing[] = [];
    for (const child of this.children) {
      const listings = await child.listSkills();
      out.push(...listings);
    }
    return out;
  }

  private async findChildForRoot(rootId: string): Promise<SkillStorage | null> {
    for (const child of this.children) {
      const roots = await child.listRoots();
      if (roots.some((r) => r.id === rootId)) return child;
    }
    return null;
  }

  async readSkill(ref: SkillRef): Promise<SkillRecord> {
    const child = await this.findChildForRoot(ref.rootId);
    if (!child) {
      throw new SkillNotFoundError(
        `No child storage owns root "${ref.rootId}"`,
        {ref},
      );
    }
    return child.readSkill(ref);
  }

  async writeSkill(
    rootId: string,
    id: string,
    content: SkillWriteContent,
  ): Promise<SkillRef> {
    const child = await this.findChildForRoot(rootId);
    if (!child) {
      throw new SkillNotFoundError(`No child storage owns root "${rootId}"`, {
        rootId,
      });
    }
    return child.writeSkill(rootId, id, content);
  }

  async deleteSkill(ref: SkillRef): Promise<void> {
    const child = await this.findChildForRoot(ref.rootId);
    if (!child) {
      throw new SkillNotFoundError(
        `No child storage owns root "${ref.rootId}"`,
        {ref},
      );
    }
    return child.deleteSkill(ref);
  }

  async resolveSkillId(id: string): Promise<SkillRef | null> {
    for (const child of this.children) {
      const match = await child.resolveSkillId(id);
      if (match) return match;
    }
    return null;
  }

  /**
   * Always implemented so consumers can call it unconditionally. Fans out
   * to children that expose `subscribe?`; if none do, this is a noop
   * returning a noop unsubscribe.
   */
  subscribe(listener: () => void): () => void {
    const unsubs: Array<() => void> = [];
    for (const child of this.children) {
      if (typeof child.subscribe === 'function') {
        unsubs.push(child.subscribe(listener));
      }
    }
    return () => {
      for (const u of unsubs) u();
    };
  }
}
