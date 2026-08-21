import type {Layer} from '@kepler.gl/layers';
import type {LayerOrder, LayerOrderGroup} from '@kepler.gl/types';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {
  LegendLayerList,
  orderLayersForLegend,
} from '../src/components/legendLayerOrder';

const group = (id: string, layerOrder: LayerOrder): LayerOrderGroup => ({
  id,
  label: id,
  isVisible: true,
  isIncludedInLegend: true,
  layerOrder,
});

describe('orderLayersForLegend', () => {
  it('uses flattened group order instead of the raw layers array', () => {
    const layers = [
      {id: 'a', config: {isVisible: true}},
      {id: 'b', config: {isVisible: false}},
      {id: 'c', config: {isVisible: true}},
    ] as Layer[];
    const layerOrder = [group('group-a', ['c', 'a']), 'b'];

    expect(orderLayersForLegend(layers, layerOrder).map(({id}) => id)).toEqual([
      'c',
      'a',
      'b',
    ]);
  });

  it.each([
    ['normal', false],
    ['export', true],
  ])('omits hidden layers when rendering in %s mode', (_mode, isExport) => {
    const layers = [
      {id: 'visible', config: {isVisible: true}},
      {id: 'hidden', config: {isVisible: false}},
    ] as Layer[];

    const markup = renderToStaticMarkup(
      createElement(
        LegendLayerList,
        {
          layers,
          layerOrder: ['hidden', 'visible'],
          isExport,
        },
        (layer: Layer) =>
          createElement('span', {'data-layer-id': layer.id}, layer.id),
      ),
    );

    expect(markup).toContain('data-layer-id="visible"');
    expect(markup).not.toContain('data-layer-id="hidden"');
  });
});
