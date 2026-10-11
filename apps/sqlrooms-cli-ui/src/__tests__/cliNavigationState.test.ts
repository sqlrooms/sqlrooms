import type {ChatSessionSchema} from '@sqlrooms/ai';
import {describe, expect, it} from '@jest/globals';
import {isCreateSessionDisabled} from '../components/sessionCreation';
import {shouldShowArtifactSelectorMenu} from '../components/selectors/CliArtifactSelector';

function createSession(
  overrides: Partial<ChatSessionSchema> = {},
): ChatSessionSchema {
  return {
    name: 'Chat',
    prompt: '',
    uiMessages: [],
    ...overrides,
  } as ChatSessionSchema;
}

describe('CLI navigation state', () => {
  it('disables chat creation only for the default empty chat', () => {
    expect(isCreateSessionDisabled(createSession())).toBe(true);
    expect(
      isCreateSessionDisabled(createSession({name: 'Named empty chat'})),
    ).toBe(false);
    expect(
      isCreateSessionDisabled(
        createSession({prompt: 'Continue this conversation'}),
      ),
    ).toBe(false);
  });

  it('shows the artifact menu when the active artifact is unlinked', () => {
    expect(
      shouldShowArtifactSelectorMenu('current-artifact', [
        {id: 'linked-artifact'},
      ]),
    ).toBe(true);
  });

  it('keeps the artifact selector compact without another linked artifact', () => {
    expect(shouldShowArtifactSelectorMenu('current-artifact', [])).toBe(false);
    expect(
      shouldShowArtifactSelectorMenu('current-artifact', [
        {id: 'current-artifact'},
      ]),
    ).toBe(false);
  });
});
