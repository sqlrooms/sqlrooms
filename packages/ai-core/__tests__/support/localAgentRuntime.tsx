/**
 * Local-agent runtime double, plus the seam that publishes it to the mocked
 * `ChatRuntimeContext` module.
 */
import {jest} from '@jest/globals';
// Type-only: importing the real module here would load it before the test
// file's `jest.unstable_mockModule` call has a chance to replace it.
import type {LocalAgentChatRuntime} from '../../src/components/ChatRuntimeContext';

/** A fully stubbed local-agent runtime, with every action a spy. */
export function createMockLocalAgentRuntime(
  overrides: Partial<LocalAgentChatRuntime> = {},
): LocalAgentChatRuntime {
  return {
    mode: 'local-agent',
    messages: [],
    status: 'ready',
    isStreaming: false,
    prompt: '',
    setPrompt: jest.fn<(value: string) => void>(),
    sendPrompt: jest.fn<(value?: string) => void>(),
    stop: jest.fn<() => Promise<void>>(async () => {}),
    initialSuggestions: [],
    suggestionsVisible: true,
    setSuggestionsVisible: jest.fn<(visible: boolean) => void>(),
    ...overrides,
  };
}

// Held in a box rather than exported directly, so the mock factory below reads
// whatever the current test most recently installed.
const runtimeRef = {current: createMockLocalAgentRuntime()};

/**
 * Installs a fresh runtime double as the one `useChatRuntime()` will return,
 * and hands it back so the caller can assert on its spies.
 */
export function setMockRuntime(
  overrides: Partial<LocalAgentChatRuntime> = {},
): LocalAgentChatRuntime {
  runtimeRef.current = createMockLocalAgentRuntime(overrides);
  return runtimeRef.current;
}

/**
 * The replacement module body for `ChatRuntimeContext`.
 *
 * The `jest.unstable_mockModule` call itself has to stay in each test file:
 * the ESM module registry is per-file, and the mocked specifier is resolved
 * relative to the file that registers it.
 */
export function mockChatRuntimeModule() {
  return {useChatRuntime: () => runtimeRef.current};
}
