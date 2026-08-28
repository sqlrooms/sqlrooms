import {describe, expect, it, jest} from '@jest/globals';
import {finalizeCreatedCliArtifact} from '../workspace/finalizeCreatedCliArtifact';

describe('finalizeCreatedCliArtifact', () => {
  it('links a created artifact to the active chat before selecting it', () => {
    const events: string[] = [];
    const addSessionArtifactLink = jest.fn(
      (sessionId: string, artifactId: string) => {
        events.push(`link:${sessionId}:${artifactId}`);
      },
    );
    const selectArtifact = jest.fn((artifactId: string) => {
      events.push(`select:${artifactId}`);
    });

    finalizeCreatedCliArtifact({
      artifactId: 'document-a',
      currentSessionId: 'chat-a',
      addSessionArtifactLink,
      selectArtifact,
    });

    expect(events).toEqual(['link:chat-a:document-a', 'select:document-a']);
  });

  it('keeps artifacts unlinked when there is no active chat', () => {
    const addSessionArtifactLink = jest.fn();
    const selectArtifact = jest.fn();

    finalizeCreatedCliArtifact({
      artifactId: 'document-a',
      addSessionArtifactLink,
      selectArtifact,
    });

    expect(addSessionArtifactLink).not.toHaveBeenCalled();
    expect(selectArtifact).toHaveBeenCalledWith('document-a');
  });
});
