import type {FC, PropsWithChildren} from 'react';

/**
 * Wraps `Component` in `Provider`, so an entry point works without the host
 * having mounted that provider itself.
 *
 * Used for the state boundaries the recipes supply on their own behalf — the
 * provider must sit *above* the component, which a hook inside it cannot do.
 */
export function withProvider<TProps extends object>(
  Provider: FC<PropsWithChildren>,
  Component: FC<TProps>,
  displayName: string,
): FC<TProps> {
  const Wrapped: FC<TProps> = (props) => (
    <Provider>
      <Component {...props} />
    </Provider>
  );
  Wrapped.displayName = displayName;
  return Wrapped;
}
