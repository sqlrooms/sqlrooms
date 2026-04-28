/**
 * In-memory `SkillStorage` used by the example. Keeps two roots:
 *
 * - `built-in`: read-only, seeded from `SEED_SKILLS` at construction time.
 * - `default`: writable, where the authoring wizard persists new skills.
 *
 * Every seed is round-tripped through `parseSkillManifest` + `loadSkillFromFiles`
 * so a malformed seed crashes the app on startup (the desired failure mode).
 */

import {
  loadSkillFromFiles,
  parseSkillManifest,
  serializeSkillManifest,
  SkillNotFoundError,
  SkillRootReadOnlyError,
  type SkillFile,
  type SkillListing,
  type SkillRecord,
  type SkillRef,
  type SkillRoot,
  type SkillStorage,
  type SkillWriteContent,
} from '@sqlrooms/ai';
import {SEED_SKILLS} from './seedSkills';

const ROOTS: SkillRoot[] = [
  {id: 'default', label: 'My skills', writable: true},
  {id: 'built-in', label: 'Built-in', writable: false},
];

interface StoredSkill {
  files: SkillFile[];
}

export class InMemorySkillStorage implements SkillStorage {
  private byRoot: Map<string, Map<string, StoredSkill>> = new Map();
  /** Notifier fired on every mutation so UI can refetch listings. */
  private listeners: Set<() => void> = new Set();

  constructor() {
    for (const root of ROOTS) this.byRoot.set(root.id, new Map());

    for (const seed of SEED_SKILLS) {
      // Validate via the real loader. A broken seed throws and the example
      // fails to boot — exactly what the architect wants.
      const {manifest} = loadSkillFromFiles(seed.files);
      if (manifest.id !== seed.id) {
        throw new Error(
          `Seed skill "${seed.id}" has mismatched manifest.id "${manifest.id}"`,
        );
      }
      const rootMap = this.byRoot.get(seed.rootId);
      if (!rootMap) {
        throw new Error(
          `Seed skill "${seed.id}" targets unknown rootId "${seed.rootId}"`,
        );
      }
      rootMap.set(seed.id, {files: seed.files});
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const l of this.listeners) l();
  }

  async listRoots(): Promise<SkillRoot[]> {
    return ROOTS;
  }

  async listSkills(rootId?: string): Promise<SkillListing[]> {
    const rootIds = rootId ? [rootId] : ROOTS.map((r) => r.id);
    const out: SkillListing[] = [];
    for (const rId of rootIds) {
      const rootMap = this.byRoot.get(rId);
      if (!rootMap) continue;
      for (const [id, stored] of rootMap) {
        const manifestFile = stored.files.find(
          (f) => f.relativePath === 'skill.yaml',
        );
        if (!manifestFile) continue;
        const manifest = parseSkillManifest(manifestFile.content);
        out.push({ref: {rootId: rId, id}, manifest});
      }
    }
    return out;
  }

  async readSkill(ref: SkillRef): Promise<SkillRecord> {
    const rootMap = this.byRoot.get(ref.rootId);
    const stored = rootMap?.get(ref.id);
    if (!stored) {
      throw new SkillNotFoundError(
        `Skill "${ref.id}" not found in root "${ref.rootId}"`,
        {ref},
      );
    }
    const {manifest, instructions, extraFiles} = loadSkillFromFiles(
      stored.files,
    );
    return {ref, manifest, instructions, extraFiles};
  }

  async writeSkill(
    rootId: string,
    id: string,
    content: SkillWriteContent,
  ): Promise<SkillRef> {
    const root = ROOTS.find((r) => r.id === rootId);
    if (!root) {
      throw new SkillNotFoundError(`Unknown root "${rootId}"`, {rootId});
    }
    if (!root.writable) {
      throw new SkillRootReadOnlyError(`Root "${rootId}" is read-only`, {
        rootId,
      });
    }
    const files: SkillFile[] = [
      {
        relativePath: 'skill.yaml',
        content: serializeSkillManifest(content.manifest),
      },
      {relativePath: 'SKILL.md', content: content.instructions},
      ...(content.extraFiles ?? []),
    ];
    // Round-trip validation.
    loadSkillFromFiles(files);
    const rootMap = this.byRoot.get(rootId);
    if (!rootMap) {
      throw new SkillNotFoundError(`Unknown root "${rootId}"`, {rootId});
    }
    rootMap.set(id, {files});
    this.notify();
    return {rootId, id};
  }

  async deleteSkill(ref: SkillRef): Promise<void> {
    const root = ROOTS.find((r) => r.id === ref.rootId);
    if (!root) {
      throw new SkillNotFoundError(`Unknown root "${ref.rootId}"`, {ref});
    }
    if (!root.writable) {
      throw new SkillRootReadOnlyError(`Root "${ref.rootId}" is read-only`, {
        ref,
      });
    }
    const rootMap = this.byRoot.get(ref.rootId);
    if (!rootMap?.has(ref.id)) {
      throw new SkillNotFoundError(
        `Skill "${ref.id}" not found in root "${ref.rootId}"`,
        {ref},
      );
    }
    rootMap.delete(ref.id);
    this.notify();
  }

  async resolveSkillId(id: string): Promise<SkillRef | null> {
    for (const root of ROOTS) {
      const rootMap = this.byRoot.get(root.id);
      if (rootMap?.has(id)) return {rootId: root.id, id};
    }
    return null;
  }
}
