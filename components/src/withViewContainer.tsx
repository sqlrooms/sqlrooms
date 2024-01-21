import React from 'react';
import QueryContainer from './QueryContainer';

export type Props = {
  // nothing yet
};

export default function withViewContainer<T extends Props = Props>(
  Component: React.ComponentType<T>,
) {
  // Try to create a nice displayName for React Dev Tools.
  const displayName = Component.displayName || Component.name || 'Component';

  // Creating the inner component. The calculated Props type here is the where the magic happens.
  const Comp = React.memo((props: Omit<T, keyof Props>) => {
    // Fetch the props you want to inject. This could be done with context instead.
    const injectProps = {};

    // props comes afterwards so the can override the default ones.
    return (
      <QueryContainer>
        <Component {...injectProps} {...(props as T)} />
      </QueryContainer>
    );
  });

  Comp.displayName = `withViewContainer(${displayName})`;

  return Comp;
}
