import {
  createContext,
  useContext,
  type FC,
  type PropsWithChildren,
} from 'react';
import {
  useChatRuntime,
  type LocalAgentChatRuntime,
} from '../ChatRuntimeContext';

/**
 * Which chat runtime a piece of normalized chat state was sourced from:
 * `'session'` reads the AI slice, `'local-agent'` reads
 * {@link LocalAgentChatRuntime} and never touches the slice.
 */
export type ChatComposerMode = 'session' | 'local-agent';

/**
 * How to build one mode-normalized chat state context.
 *
 * @typeParam TState - The normalized state shape both modes produce.
 */
export type DualModeChatContextConfig<TState> = {
  /** The reader hook's name, quoted back in its missing-state error. */
  hookName: string;
  /** The local-agent provider's name, quoted in its mode-mismatch error. */
  localAgentProviderName: string;
  /** The boundary component's name, suggested as a fix in the error. */
  boundaryName: string;
  /** Builds session-mode state. Only ever called under the session provider. */
  useSessionState: () => TState;
  /** Builds local-agent-mode state from an already-narrowed runtime. */
  useLocalAgentState: (runtime: LocalAgentChatRuntime) => TState;
  /**
   * Rendered around whichever provider the boundary mounts, for state that
   * depends on another context being published first.
   */
  BoundaryOuter?: FC<PropsWithChildren>;
};

/**
 * Builds the provider/boundary/reader set shared by every mode-normalized chat
 * state context (the composer's and the suggestions').
 *
 * Each such context needs the same five pieces, and they have to agree with
 * each other: two providers that publish the same shape from different
 * sources, a boundary that supplies session-mode state when nothing else did,
 * and a reader that refuses to guess when nothing published at all. Building
 * them together keeps that agreement structural instead of a copy-paste
 * convention.
 *
 * **Why the boundary dispatches, not the reader.** The session state hook
 * reads the AI slice, so it must not run in local-agent trees — which may have
 * no AI slice in their room store at all. The boundary reads
 * {@link useChatRuntime} and mounts the matching provider, keeping each mode's
 * hook inside a child that mounts as a unit, so a local-agent tree never
 * renders the session one. A reader that silently defaulted to session mode
 * would reach for a slice that isn't there.
 */
export function createDualModeChatContext<TState>({
  hookName,
  localAgentProviderName,
  boundaryName,
  useSessionState,
  useLocalAgentState,
  BoundaryOuter,
}: DualModeChatContextConfig<TState>) {
  const Context = createContext<TState | null>(null);

  const SessionProvider: FC<PropsWithChildren> = ({children}) => (
    <Context.Provider value={useSessionState()}>{children}</Context.Provider>
  );
  SessionProvider.displayName = `Session${boundaryName}Provider`;

  const LocalAgentProvider: FC<PropsWithChildren> = ({children}) => {
    const runtime = useChatRuntime();
    if (runtime.mode !== 'local-agent') {
      throw new Error(
        `${localAgentProviderName} must be rendered inside LocalAgentChatRuntimeProvider (i.e. under Chat.LocalAgentRoot).`,
      );
    }
    return (
      <Context.Provider value={useLocalAgentState(runtime)}>
        {children}
      </Context.Provider>
    );
  };
  LocalAgentProvider.displayName = localAgentProviderName;

  const StateBoundary: FC<PropsWithChildren> = ({children}) => {
    const provided = useContext(Context);
    const runtime = useChatRuntime();
    if (provided) return <>{children}</>;

    // Dispatch on the surrounding runtime, not on session mode unconditionally:
    // a host may render `LocalAgentChatRuntimeProvider` directly without either
    // `Chat` root, and defaulting to session there would read an AI slice that
    // such a store need not have.
    // `BoundaryOuter` wraps either branch: the suggestions context depends on
    // composer state being published first, in both modes.
    const inner =
      runtime.mode === 'local-agent' ? (
        <LocalAgentProvider>{children}</LocalAgentProvider>
      ) : (
        <SessionProvider>{children}</SessionProvider>
      );
    return BoundaryOuter ? <BoundaryOuter>{inner}</BoundaryOuter> : inner;
  };
  StateBoundary.displayName = boundaryName;

  function useChatState(): TState {
    const provided = useContext(Context);
    if (!provided) {
      throw new Error(
        `${hookName}() found no state. Render it under <Chat>, <Chat.Root>, ` +
          `<Chat.LocalAgentRoot>, or wrap it in <${boundaryName}>.`,
      );
    }
    return provided;
  }

  return {SessionProvider, LocalAgentProvider, StateBoundary, useChatState};
}
