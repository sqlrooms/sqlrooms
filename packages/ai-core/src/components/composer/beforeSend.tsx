import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type PropsWithChildren,
} from 'react';

/**
 * A synchronous pre-send veto: called with the text about to be sent, and
 * returning `false` to abort. Any other return value proceeds.
 */
export type BeforeSendHandler = (text: string) => boolean | void;

type BeforeSendRegistry = {
  /**
   * Adds `handler` to the veto set and returns its remover. `exclusiveKey`
   * names a role only one registration should fill; a second one still takes
   * effect (dropping a host's veto would be worse) but warns in development.
   */
  register: (handler: BeforeSendHandler, exclusiveKey?: string) => () => void;
  /** Runs the registered handlers in mount order; `false` if one vetoed. */
  run: (text: string) => boolean;
  /**
   * Marks sends as unconditionally blocked while the returned disposer is
   * unused. Unlike a veto — a function nobody can inspect ahead of time — this
   * is reactive state, so controls can render as disabled instead of looking
   * live and silently doing nothing.
   */
  block: () => () => void;
  /** True while any {@link block} is held. */
  blocked: boolean;
};

const NO_VETOES: BeforeSendRegistry = {
  register: () => () => {},
  run: () => true,
  block: () => () => {},
  blocked: false,
};

const BeforeSendContext = createContext<BeforeSendRegistry | null>(null);

/**
 * Holds the pre-send vetoes that {@link useChatComposer}'s `send` consults.
 *
 * Sits *above* the composer state providers, since `send` is built there while
 * vetoes come from descendants. A mutable set read at call time bridges that:
 * the registry identity is stable, so registering never rebuilds `send`.
 *
 * Idempotent — an inherited registry passes through, so a nested boundary
 * cannot split registration from the `send` that consults it.
 *
 * **Sharing is by React ancestry.** Two *sibling* surfaces that each fall back
 * to their own state boundary — a standalone `QueryControls` next to a
 * standalone `PromptSuggestions`, say — get separate registries, so a policy
 * registered by one is not observed by the other. Give them a common `<Chat>`
 * or `ChatSuggestionsStateBoundary` ancestor when the policy must span both.
 * This is not detectable at registration time: a lone standalone composer with
 * an `onRun` is correct and common, and indistinguishable from the sibling case.
 */
export const ChatComposerBeforeSendProvider: FC<PropsWithChildren> = ({
  children,
}) => {
  const inherited = useContext(BeforeSendContext);
  const handlers = useRef<Set<BeforeSendHandler>>(new Set()).current;
  const exclusiveCounts = useRef<Map<string, number>>(new Map()).current;
  // Reactive, unlike `handlers`: whether sends are blocked has to reach the
  // state providers above, so controls can disable rather than no-op.
  const [blockCount, setBlockCount] = useState(0);

  // Stable identity, deliberately: `useBlockSends` has this in its effect
  // deps, so a `block` that changed with `blockCount` would make every block
  // release and re-acquire itself on the render it just caused.
  const block = useCallback(() => {
    setBlockCount((n) => n + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      setBlockCount((n) => n - 1);
    };
  }, []);

  const registry = useMemo<BeforeSendRegistry>(
    () => ({
      block,
      blocked: blockCount > 0,
      register: (handler, exclusiveKey) => {
        if (exclusiveKey !== undefined) {
          const held = exclusiveCounts.get(exclusiveKey) ?? 0;
          if (held > 0 && process.env.NODE_ENV !== 'production') {
            console.warn(
              `[sqlrooms] Two chat surfaces under one <Chat> root registered a ` +
                `'${exclusiveKey}' pre-send veto, so both run for every send ` +
                `from either surface. Pass a chat-wide policy once via ` +
                `useRegisterBeforeSend(), or give each surface its own root.`,
            );
          }
          exclusiveCounts.set(exclusiveKey, held + 1);
        }
        handlers.add(handler);
        return () => {
          handlers.delete(handler);
          if (exclusiveKey !== undefined) {
            const held = exclusiveCounts.get(exclusiveKey) ?? 1;
            if (held <= 1) exclusiveCounts.delete(exclusiveKey);
            else exclusiveCounts.set(exclusiveKey, held - 1);
          }
        };
      },
      // Stops at the first veto: handlers may have side effects (creating a
      // session), so an aborted send should trigger as few as possible.
      // Multiple vetoes run in mount order.
      run: (text) => {
        for (const handler of handlers) {
          if (handler(text) === false) return false;
        }
        return true;
      },
    }),
    [handlers, exclusiveCounts, blockCount, block],
  );

  if (inherited) return <>{children}</>;
  return (
    <BeforeSendContext.Provider value={registry}>
      {children}
    </BeforeSendContext.Provider>
  );
};

/** Falls back to a no-op registry so primitives work outside any provider. */
function useBeforeSendRegistry(): BeforeSendRegistry {
  return useContext(BeforeSendContext) ?? NO_VETOES;
}

/**
 * Whether sends are currently blocked outright — see the registry's `block`.
 */
export function useSendsBlocked(): boolean {
  return useBeforeSendRegistry().blocked;
}

/**
 * Blocks every send while the calling component is mounted, reported through
 * {@link ChatComposerState.sendBlocked} so controls render disabled instead of
 * appearing live and doing nothing.
 *
 * For a state that makes sending impossible chat-wide (a missing credential);
 * conditional policies want {@link useRegisterBeforeSend}.
 */
export function useBlockSends(enabled = true): void {
  const {block} = useBeforeSendRegistry();
  useEffect(() => {
    if (!enabled) return;
    return block();
  }, [block, enabled]);
}

/**
 * Wraps `send` so registered vetoes are consulted first. Applied inside each
 * mode's state hook, which is what makes a veto reach every caller of
 * `send` — a suggestion row, a command — not just the composer's controls.
 *
 * @param send - The mode's raw send action.
 * @param prompt - Used as the veto's argument when `send` gets no text.
 * @param canSendText - The mode's readiness predicate, consulted before any
 *   handler runs so a vetoed-or-impossible send triggers no side effects.
 */
export function useVetoableSend(
  send: (text?: string) => void,
  prompt: string,
  canSendText: (text: string) => boolean,
): (text?: string) => void {
  const {run, blocked} = useBeforeSendRegistry();
  return useCallback(
    // Rest args, so "no text" forwards as no argument rather than an explicit
    // `undefined` — invisible to a `send` that distinguishes the two.
    (...args: [text?: string]) => {
      const text = args[0] ?? prompt;
      // Readiness is checked *before* the vetoes, not after. Handlers have side
      // effects — creating an artifact or a session — and `send` is documented
      // as a no-op when sending isn't possible, so running them ahead of the
      // mode's own guard would perform those effects for a send that never
      // happens.
      if (blocked || !canSendText(text)) return;
      if (!run(text)) return;
      send(...args);
    },
    [run, blocked, canSendText, send, prompt],
  );
}

/**
 * Registers a pre-send veto for as long as the calling component is mounted.
 *
 * The veto applies to every send routed through {@link useChatComposer},
 * whatever triggered it — which is the point: a policy the composer enforces
 * and a suggestion row bypasses is a policy two surfaces disagree about.
 *
 * **Chat-wide, not per-surface.** One `<Chat>` root has one registry, which is
 * what stops a suggestion row bypassing a policy the composer enforces — but
 * it also means two composers under one root share vetoes. Independent
 * surfaces need separate roots.
 *
 * @param handler - Called with the text about to be sent; return `false` to
 *   abort. May be a fresh closure each render. `undefined` registers nothing.
 * @param exclusiveKey - Names a role only one registration should fill, for a
 *   dev-time duplicate warning. Omit for policies that may legitimately stack.
 */
export function useRegisterBeforeSend(
  handler: BeforeSendHandler | undefined,
  exclusiveKey?: string,
): void {
  const {register} = useBeforeSendRegistry();
  const latest = useRef(handler);

  useEffect(() => {
    latest.current = handler;
  }, [handler]);

  const enabled = handler !== undefined;

  useEffect(() => {
    if (!enabled) return;
    // A stable trampoline, so a fresh closure each render does not churn the
    // registry.
    return register((text) => latest.current?.(text), exclusiveKey);
  }, [register, enabled, exclusiveKey]);
}
