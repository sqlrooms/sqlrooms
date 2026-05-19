/**
 * The capability surface the host exposes to the authoring agent. The agent
 * may mention these names when drafting instructions; it may not mention
 * concrete schema (see `forbiddenIdentifiers`).
 *
 * All fields are generic lists of strings so the host controls its own
 * vocabulary — this type carries no knowledge of any specific analytics app,
 * service, or runtime.
 */
export interface SkillAuthoringContext {
  /**
   * Named services the drafted skill may reference (e.g. the sub-apis of an
   * `execute`-style tool the host exposes). Empty list is valid.
   */
  services: readonly string[];

  /**
   * Leaf tools available at skill runtime (e.g. `querySQL`, `readFile`).
   * Empty list is valid.
   */
  tools: readonly string[];

  /**
   * Permission keys the host recognizes. Currently unused by the manifest
   * schema but surfaced in the system prompt for forward compatibility.
   * Empty list is valid.
   */
  permissions: readonly string[];

  /**
   * Identifiers (e.g. current table names) that must not appear verbatim in
   * manifest fields or instructions. Matched case-insensitively on word
   * boundaries. Optional — omit if the host has no contextual identifiers.
   */
  forbiddenIdentifiers?: readonly string[];

  /**
   * Root the wizard writes to when `saveSkill` is called without an explicit
   * `rootId`. Optional — the host may also require the agent to pass one.
   */
  defaultRootId?: string;
}
