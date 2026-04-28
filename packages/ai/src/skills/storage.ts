import type {SkillManifest} from './manifest';

/**
 * A logical storage root that groups skills. Hosts typically wire multiple
 * roots in priority order (e.g. installed > user > built-in).
 */
export interface SkillRoot {
  /** Stable identifier for this root (e.g. `"user"`, `"built-in"`). */
  id: string;
  /** Human-readable label suitable for UI surfaces. */
  label: string;
  /** Whether the root accepts writes. Read-only roots reject `writeSkill`. */
  writable: boolean;
}

/**
 * A reference to a specific skill living in a specific root.
 * `{rootId, id}` is globally unique across a `SkillStorage` instance.
 */
export interface SkillRef {
  rootId: string;
  id: string;
}

/**
 * A file belonging to a skill directory, addressed by its path relative to
 * the skill's root folder.
 */
export interface SkillFile {
  relativePath: string;
  content: string;
}

/**
 * The full record for a single skill: its ref, parsed manifest, instructions
 * body, and any additional files (icons, references, etc.).
 *
 * Invariant: `extraFiles` never contains `skill.yaml` or `SKILL.md` — those
 * are already represented by `manifest` and `instructions`. Storing them
 * twice would invite drift on round-trip.
 */
export interface SkillRecord {
  ref: SkillRef;
  manifest: SkillManifest;
  instructions: string;
  extraFiles: SkillFile[];
}

/**
 * Lightweight listing entry used for catalog views that don't need file
 * contents.
 */
export interface SkillListing {
  ref: SkillRef;
  manifest: SkillManifest;
}

/**
 * Content payload passed to `writeSkill`. The manifest is the structured
 * form; `extraFiles` is for auxiliary files (icons, references, etc.) that
 * live alongside `skill.yaml` and `SKILL.md`.
 */
export interface SkillWriteContent {
  manifest: SkillManifest;
  instructions: string;
  extraFiles?: SkillFile[];
}

/**
 * Abstract storage backend for skills. Implementations may be filesystem,
 * in-memory, HTTP, OPFS, etc. All operations are Promise-based.
 *
 * Priority is encoded in the order returned by `listRoots()`: earlier roots
 * override later ones for `resolveSkillId` conflict resolution.
 */
export interface SkillStorage {
  /**
   * Enumerate all roots known to this storage, in priority order (highest
   * priority first).
   */
  listRoots(): Promise<SkillRoot[]>;

  /**
   * List skills. If `rootId` is provided, returns only skills from that root.
   * When called without a rootId, returns skills from every root; duplicates
   * (same `id` in multiple roots) are included so callers can render conflict
   * indicators.
   */
  listSkills(rootId?: string): Promise<SkillListing[]>;

  /**
   * Read the full record for a single skill.
   *
   * @throws a `SkillNotFoundError` if the ref does not resolve.
   * @throws a `SkillManifestError` if the skill's `skill.yaml` fails to parse
   * or validate.
   */
  readSkill(ref: SkillRef): Promise<SkillRecord>;

  /**
   * Create or overwrite a skill in the given root. Returns the resulting ref.
   *
   * @throws a `SkillRootReadOnlyError` if the target root is not writable.
   */
  writeSkill(
    rootId: string,
    id: string,
    content: SkillWriteContent,
  ): Promise<SkillRef>;

  /**
   * Remove a skill from its root.
   *
   * @throws a `SkillRootReadOnlyError` if the ref's root is not writable.
   * @throws a `SkillNotFoundError` if the ref does not resolve.
   */
  deleteSkill(ref: SkillRef): Promise<void>;

  /**
   * Given a bare skill id, return the highest-priority `SkillRef` that holds
   * it, or `null` if no root has the id.
   */
  resolveSkillId(id: string): Promise<SkillRef | null>;
}
