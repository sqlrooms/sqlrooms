import {renderToStaticMarkup} from 'react-dom/server';
import type {
  Dimensions,
  UseAspectRatioDimensionsProps,
} from '../src/hooks/useAspectRatioDimensions';
import {useAspectRatioDimensions} from '../src/hooks/useAspectRatioDimensions';

function renderDimensions(
  props: Omit<UseAspectRatioDimensionsProps, 'containerRef'>,
): Dimensions {
  let dimensions: Dimensions | undefined;

  function HookProbe() {
    dimensions = useAspectRatioDimensions({
      ...props,
      containerRef: {current: null},
    });
    return null;
  }

  renderToStaticMarkup(<HookProbe />);

  if (!dimensions) {
    throw new Error('Hook did not return dimensions');
  }
  return dimensions;
}

describe('useAspectRatioDimensions', () => {
  it('preserves explicit dimensions when aspect ratio is undefined', () => {
    expect(
      renderDimensions({
        width: 640,
        height: 360,
        aspectRatio: undefined,
      }),
    ).toEqual({width: 640, height: 360});
  });

  it('derives height from an explicit width and aspect ratio', () => {
    expect(
      renderDimensions({width: 320, height: 'auto', aspectRatio: 16 / 9}),
    ).toEqual({width: 320, height: 180});
  });

  it('derives width from an explicit height and aspect ratio', () => {
    expect(
      renderDimensions({width: 'auto', height: 180, aspectRatio: 16 / 9}),
    ).toEqual({width: 320, height: 180});
  });
});
