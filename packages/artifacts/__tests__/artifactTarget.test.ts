import {resolveArtifactTargetId} from '../src';

describe('resolveArtifactTargetId', () => {
  const aiInvocation = {
    surface: 'ai' as const,
    target: {kind: 'artifact', id: 'artifact-a'},
  };

  it('prefers an explicit artifact over the AI turn target', () => {
    expect(
      resolveArtifactTargetId({
        requestedArtifactId: 'artifact-b',
        invocation: aiInvocation,
        currentArtifactId: 'artifact-c',
      }),
    ).toBe('artifact-b');
  });

  it('uses the captured AI turn target instead of the live artifact', () => {
    expect(
      resolveArtifactTargetId({
        invocation: aiInvocation,
        currentArtifactId: 'artifact-b',
      }),
    ).toBe('artifact-a');
  });

  it('uses the live artifact for non-AI invocations', () => {
    expect(
      resolveArtifactTargetId({
        invocation: {surface: 'palette', target: aiInvocation.target},
        currentArtifactId: 'artifact-b',
      }),
    ).toBe('artifact-b');
  });

  it('preserves the live fallback when an AI turn has no captured artifact', () => {
    expect(
      resolveArtifactTargetId({
        invocation: {surface: 'ai'},
        currentArtifactId: 'artifact-b',
      }),
    ).toBe('artifact-b');
  });
});
