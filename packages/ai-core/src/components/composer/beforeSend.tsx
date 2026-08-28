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
   * Blocks sends unconditionally until the returned disposer runs. Reactive,
   * unlike a veto, so controls can render disabled instead of silently
   * no-opping.
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
 * Sharing follows React ancestry — sibling surfaces that each fall back to
 * their own boundary get separate registries. Give them a common `<Chat>` or
 * `ChatSuggestionsStateBoundary` ancestor when a policy must span both.
 */
export const ChatComposerBeforeSendProvider: FC<PropsWithChildren> = ({
  children,
}) => {
  const inherited = useContext(BeforeSendContext);
  const handlers = useRef<Set<BeforeSendHandler>>(new Set()).current;
  const exclusiveCounts = useRef<Map<string, number>>(new Map()).current;
  // Reactive, unlike `handlers`: the state providers above must see this.
  const [blockCount, setBlockCount] = useState(0);

  // Stable identity: `useBlockSends` has this in its effect deps.
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
      // Stops at the first veto: handlers may have side effects.
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
 * {@link ChatComposerState.sendBlocked}.
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
 * mode's state hook, so a veto reaches every caller of `send`.
 *
 * @param send - The mode's raw send action.
 * @param prompt - Used as the veto's argument when `send` gets no text.
 * @param canSend - The mode's readiness predicate, consulted before any
 *   handler runs so a vetoed-or-impossible send triggers no side effects.
 */
export function useVetoableSend(
  send: (text?: string) => void,
  prompt: string,
  canSend: (text: string) => boolean,
): (text?: string) => void {
  const {run, blocked} = useBeforeSendRegistry();
  return useCallback(
    // Rest args so "no text" forwards as no argument, not explicit `undefined`.
    (...args: [text?: string]) => {
      const text = args[0] ?? prompt;
      // Readiness before vetoes: handlers have side effects, and `send` is
      // documented as a no-op when sending isn't possible.
      if (blocked || !canSend(text)) return;
      if (!run(text)) return;
      send(...args);
    },
    [run, blocked, canSend, send, prompt],
  );
}

/**
 * Registers a pre-send veto for as long as the calling component is mounted.
 *
 * **Chat-wide, not per-surface.** One `<Chat>` root has one registry: a
 * suggestion row cannot bypass a policy the composer enforces, but two
 * composers under one root also share vetoes. Independent surfaces need
 * separate roots.
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
    return register((text) => latest.current?.(text), exclusiveKey);
  }, [register, enabled, exclusiveKey]);
}
