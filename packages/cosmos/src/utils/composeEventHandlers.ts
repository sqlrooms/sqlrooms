import type {GraphConfig} from '@cosmos.gl/graph';

type MouseMoveHandler = Required<GraphConfig>['onMouseMove'];

/** Combines the wrapper's mouse-move handler with an optional caller handler. */
export function composeMouseMoveHandlers(
  internalHandler: MouseMoveHandler,
  configuredHandler: GraphConfig['onMouseMove'],
): MouseMoveHandler {
  return (...args) => {
    internalHandler(...args);
    configuredHandler?.(...args);
  };
}
