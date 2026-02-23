import {renderHook, act} from '@testing-library/react';
import {useHoverState} from '../src/hooks/useHoverState';

describe('useHoverState', () => {
  const mockCalcRelativeCoordinates = jest.fn(
    (clientX: number, clientY: number) => [clientX + 10, clientY + 20] as [
      number,
      number,
    ],
  );

  beforeEach(() => {
    mockCalcRelativeCoordinates.mockClear();
  });

  it('should initialize with null hover state', () => {
    const {result} = renderHook(() =>
      useHoverState(mockCalcRelativeCoordinates),
    );

    expect(result.current.hoveredPoint).toBeNull();
  });

  it('should provide event handlers', () => {
    const {result} = renderHook(() =>
      useHoverState(mockCalcRelativeCoordinates),
    );

    expect(result.current.eventHandlers).toHaveProperty('onPointMouseOver');
    expect(result.current.eventHandlers).toHaveProperty('onPointMouseOut');
    expect(result.current.eventHandlers).toHaveProperty('onZoomStart');
    expect(result.current.eventHandlers).toHaveProperty('onDragStart');
  });

  it('should update hover state on point mouse over with valid event', () => {
    const {result} = renderHook(() =>
      useHoverState(mockCalcRelativeCoordinates),
    );

    act(() => {
      result.current.eventHandlers.onPointMouseOver(
        5,
        [100, 200],
        {clientX: 150, clientY: 250} as MouseEvent,
      );
    });

    expect(result.current.hoveredPoint).toEqual({
      index: 5,
      position: [160, 270],
    });
    expect(mockCalcRelativeCoordinates).toHaveBeenCalledWith(150, 250);
  });

  it('should not update hover state if event lacks client coordinates', () => {
    const {result} = renderHook(() =>
      useHoverState(mockCalcRelativeCoordinates),
    );

    act(() => {
      result.current.eventHandlers.onPointMouseOver(
        5,
        [100, 200],
        {} as MouseEvent,
      );
    });

    expect(result.current.hoveredPoint).toBeNull();
    expect(mockCalcRelativeCoordinates).not.toHaveBeenCalled();
  });

  it('should clear hover state on point mouse out', () => {
    const {result} = renderHook(() =>
      useHoverState(mockCalcRelativeCoordinates),
    );

    // First set hover state
    act(() => {
      result.current.eventHandlers.onPointMouseOver(
        5,
        [100, 200],
        {clientX: 150, clientY: 250} as MouseEvent,
      );
    });

    expect(result.current.hoveredPoint).not.toBeNull();

    // Then clear it
    act(() => {
      result.current.eventHandlers.onPointMouseOut();
    });

    expect(result.current.hoveredPoint).toBeNull();
  });

  it('should clear hover state on zoom start', () => {
    const {result} = renderHook(() =>
      useHoverState(mockCalcRelativeCoordinates),
    );

    act(() => {
      result.current.eventHandlers.onPointMouseOver(
        5,
        [100, 200],
        {clientX: 150, clientY: 250} as MouseEvent,
      );
    });

    expect(result.current.hoveredPoint).not.toBeNull();

    act(() => {
      result.current.eventHandlers.onZoomStart();
    });

    expect(result.current.hoveredPoint).toBeNull();
  });

  it('should clear hover state on drag start', () => {
    const {result} = renderHook(() =>
      useHoverState(mockCalcRelativeCoordinates),
    );

    act(() => {
      result.current.eventHandlers.onPointMouseOver(
        5,
        [100, 200],
        {clientX: 150, clientY: 250} as MouseEvent,
      );
    });

    expect(result.current.hoveredPoint).not.toBeNull();

    act(() => {
      result.current.eventHandlers.onDragStart();
    });

    expect(result.current.hoveredPoint).toBeNull();
  });

  it('should handle multiple hover state updates', () => {
    const {result} = renderHook(() =>
      useHoverState(mockCalcRelativeCoordinates),
    );

    act(() => {
      result.current.eventHandlers.onPointMouseOver(
        1,
        [50, 60],
        {clientX: 100, clientY: 120} as MouseEvent,
      );
    });

    expect(result.current.hoveredPoint).toEqual({
      index: 1,
      position: [110, 140],
    });

    act(() => {
      result.current.eventHandlers.onPointMouseOver(
        2,
        [70, 80],
        {clientX: 200, clientY: 220} as MouseEvent,
      );
    });

    expect(result.current.hoveredPoint).toEqual({
      index: 2,
      position: [210, 240],
    });
  });

  it('should maintain stable event handler references', () => {
    const {result, rerender} = renderHook(() =>
      useHoverState(mockCalcRelativeCoordinates),
    );

    const firstHandlers = result.current.eventHandlers;

    rerender();

    expect(result.current.eventHandlers).toBe(firstHandlers);
  });
});