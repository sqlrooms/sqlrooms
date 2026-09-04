export type FinalizeCreatedCliArtifactOptions = {
  artifactId: string;
  currentSessionId?: string;
  addSessionArtifactLink: (sessionId: string, artifactId: string) => void;
  selectArtifact: (artifactId: string) => void;
};

/** Links a UI-created artifact to the active chat before selecting it. */
export function finalizeCreatedCliArtifact({
  artifactId,
  currentSessionId,
  addSessionArtifactLink,
  selectArtifact,
}: FinalizeCreatedCliArtifactOptions): void {
  if (currentSessionId) {
    addSessionArtifactLink(currentSessionId, artifactId);
  }
  selectArtifact(artifactId);
}
