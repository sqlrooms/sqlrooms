/**
 * Local-agent runtime double, plus the seam that publishes it to the mocked
 * `ChatRuntimeContext` module.
 */
import {jest} from '@jest/globals';
// Type-only: importing the real module here would load it before the test
// file's `jest.unstable_mockModule` call has a chance to replace it.
import type {LocalAgentChatRuntime} from '../../src/components/ChatRuntimeContext';
import type {FileUIPart} from 'ai';

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
    sendPrompt: jest.fn<(value?: string, attachments?: FileUIPart[]) => void>(),
    stop: jest.fn<() => Promise<void>>(async () => {}),
    initialSuggestions: [],
    suggestionsVisible: true,
    setSuggestionsVisible: jest.fn<(visible: boolean) => void>(),
    ...overrides,
  };
}

// Held in a box rather than exported directly, so the mock factory below reads
// whatever the current test most recently installed. Defaults to session mode,
// matching the real context's default — the mocked module replaces the whole
// context, so a local-agent default would put every session-mode test in the
// wrong runtime.
const runtimeRef: {current: LocalAgentChatRuntime | {mode: 'session'}} = {
  current: {mode: 'session'},
};

/**
 * Installs a session-mode runtime, as an unmocked tree would see by default.
 * Use in `beforeEach` to reset between tests.
 */
export function setMockSessionRuntime(): void {
  runtimeRef.current = {mode: 'session'};
}

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
