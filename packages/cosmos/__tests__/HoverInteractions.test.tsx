import {act, renderHook} from '@testing-library/react';
import {describe, expect, it, jest} from '@jest/globals';
import type {GraphConfig} from '@cosmos.gl/graph';
import {useHoverState} from '../src/hooks/useHoverState';
import {composeMouseMoveHandlers} from '../src/utils/composeEventHandlers';

type MouseMoveHandler = Required<GraphConfig>['onMouseMove'];

describe('Cosmos hover interactions', () => {
  it('forwards mouse moves to both internal and configured handlers', () => {
    const internalHandler = jest.fn<MouseMoveHandler>();
    const configuredHandler = jest.fn<MouseMoveHandler>();
    const handler = composeMouseMoveHandlers(
      internalHandler,
      configuredHandler,
    );
    const args = [
      3,
      [10, 20],
      new MouseEvent('mousemove', {clientX: 125, clientY: 75}),
    ] as Parameters<MouseMoveHandler>;

    handler(...args);

    expect(internalHandler).toHaveBeenCalledTimes(1);
    expect(internalHandler).toHaveBeenCalledWith(...args);
    expect(configuredHandler).toHaveBeenCalledTimes(1);
    expect(configuredHandler).toHaveBeenCalledWith(...args);
  });

  it('uses the latest mouse position when point hover has no event', () => {
    const calcRelativeCoordinates = jest.fn(
      (clientX: number, clientY: number): [number, number] => [
        clientX - 100,
        clientY - 50,
      ],
    );
    const {result} = renderHook(() => useHoverState(calcRelativeCoordinates));
    const mouseMoveArgs = [
      3,
      [10, 20],
      new MouseEvent('mousemove', {clientX: 125, clientY: 75}),
    ] as Parameters<MouseMoveHandler>;

    act(() => {
      result.current.eventHandlers.onMouseMove(...mouseMoveArgs);
      result.current.eventHandlers.onPointMouseOver(
        7,
        mouseMoveArgs[1],
        undefined as never,
      );
    });

    expect(calcRelativeCoordinates).toHaveBeenCalledWith(125, 75);
    expect(result.current.hoveredPoint).toEqual({
      index: 7,
      position: [25, 25],
    });
  });
});
