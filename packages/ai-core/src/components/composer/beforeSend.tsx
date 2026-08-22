import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type FC,
  type PropsWithChildren,
} from 'react';

/**
 * A synchronous pre-send veto: called with the text about to be sent, and
 * returning `false` to abort. Any other return value proceeds.
 */
export type BeforeSendHandler = (text: string) => boolean | void;

type BeforeSendRegistry = {
  /** Adds `handler` to the veto set and returns its remover. */
  register: (handler: BeforeSendHandler) => () => void;
  /** Runs the registered handlers in mount order; `false` if one vetoed. */
  run: (text: string) => boolean;
};

const NO_VETOES: BeforeSendRegistry = {
  register: () => () => {},
  run: () => true,
};

const BeforeSendContext = createContext<BeforeSendRegistry | null>(null);

/**
 * Holds the pre-send vetoes that {@link useChatComposer}'s `send` consults.
 *
 * Rendered *above* the composer state providers, because `send` is built there
 * while the vetoes come from descendants — a composer recipe deep in the tree,
 * typically. A mutable set read at call time is what bridges that gap: the
 * registry's identity stays stable, so registering a veto never rebuilds
 * `send` or re-renders anything reading composer state.
 *
 * Idempotent. If an ancestor already provides a registry, `children` render
 * unchanged, so a nested boundary cannot split registration from the `send`
 * that consults it.
 */
export const ChatComposerBeforeSendProvider: FC<PropsWithChildren> = ({
  children,
}) => {
  const inherited = useContext(BeforeSendContext);
  const handlers = useRef<Set<BeforeSendHandler>>(new Set()).current;

  const registry = useMemo<BeforeSendRegistry>(
    () => ({
      register: (handler) => {
        handlers.add(handler);
        return () => {
          handlers.delete(handler);
        };
      },
      // Stops at the first veto: handlers are expected to have side effects
      // (creating a session, say), so an aborted send should trigger as few of
      // them as possible. Stacking several vetoes is not a designed use case;
      // with more than one, they run in mount order.
      run: (text) => {
        for (const handler of handlers) {
          if (handler(text) === false) return false;
        }
        return true;
      },
    }),
    [handlers],
  );

  if (inherited) return <>{children}</>;
  return (
    <BeforeSendContext.Provider value={registry}>
      {children}
    </BeforeSendContext.Provider>
  );
};

/**
 * Reads the veto registry, falling back to a no-op one so a primitive used
 * outside any provider still works.
 */
function useBeforeSendRegistry(): BeforeSendRegistry {
  return useContext(BeforeSendContext) ?? NO_VETOES;
}

/**
 * Wraps `send` so the registered pre-send vetoes are consulted first.
 *
 * Applied inside each mode's state hook, which is what makes a veto reach
 * *every* caller of {@link useChatComposer}'s `send` — a suggestion row, a
 * command, a host's own button — and not just the composer's own controls.
 *
 * @param send - The mode's raw send action.
 * @param prompt - The current prompt, used as the veto's argument when `send`
 *   is called with no text of its own.
 */
export function useVetoableSend(
  send: (text?: string) => void,
  prompt: string,
): (text?: string) => void {
  const {run} = useBeforeSendRegistry();
  return useCallback(
    // Rest args rather than a named parameter, so "no text" is forwarded as no
    // argument instead of an explicit `undefined` — the wrapper stays
    // invisible to a `send` that distinguishes the two.
    (...args: [text?: string]) => {
      if (!run(args[0] ?? prompt)) return;
      send(...args);
    },
    [run, send, prompt],
  );
}

/**
 * Registers a pre-send veto for as long as the calling component is mounted.
 *
 * The veto applies to every send routed through {@link useChatComposer},
 * whatever triggered it — which is the point: a policy the composer enforces
 * and a suggestion row bypasses is a policy two surfaces disagree about.
 *
 * @param handler - Called with the text about to be sent; return `false` to
 *   abort. May be a fresh closure each render — the latest one is always the
 *   one called. Pass `undefined` to register nothing.
 */
export function useRegisterBeforeSend(
  handler: BeforeSendHandler | undefined,
): void {
  const {register} = useBeforeSendRegistry();
  const latest = useRef(handler);

  useEffect(() => {
    latest.current = handler;
  }, [handler]);

  const enabled = handler !== undefined;

  useEffect(() => {
    if (!enabled) return;
    // A stable trampoline is registered rather than `handler` itself, so a
    // caller passing a new closure each render does not churn the registry.
    return register((text) => latest.current?.(text));
  }, [register, enabled]);
}
