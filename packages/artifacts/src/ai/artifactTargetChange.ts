/**
 * Describes an artifact selection change that may become the continuation
 * target for an artifact-scoped AI chat.
 *
 * The shape is intentionally metadata-only so generic commands and tools can
 * report artifact target changes without depending on any host app's handoff
 * policy. Host apps decide whether and when to fork or switch AI sessions.
 */
export type ArtifactTargetChange = {
  /** Artifact that became the primary working target. */
  artifactId: string;
  /** Runtime artifact type, such as `block-document`, `dashboard`, or `document`. */
  artifactType: string;
  /** Human-readable artifact title at the time of the change. */
  title: string;
  /** Whether the artifact was newly created or an existing artifact was selected. */
  change: 'created' | 'selected';
  /**
   * Hint that an artifact-scoped AI chat should continue in this target.
   *
   * This is not a command to fork by itself. Host apps should still restrict
   * handoff behavior to their own AI/tool invocation surfaces.
   */
  shouldContinueChat?: boolean;
};

/**
 * Optional command/tool result payload field for standard artifact target
 * changes.
 */
export type ArtifactTargetChangeData = {
  artifactTargetChange?: ArtifactTargetChange;
};
