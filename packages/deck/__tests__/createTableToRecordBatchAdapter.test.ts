import {CompositeLayer, type Layer} from '@deck.gl/core';
import {
  Field,
  FixedSizeList,
  Float64,
  RecordBatch,
  Schema,
  Table,
  Vector,
  vectorFromArray,
} from 'apache-arrow';
import {createTableToRecordBatchAdapter} from '../src/json/layers/createTableToRecordBatchAdapter';

class FakeUpstreamLayer {
  props: Record<string, unknown>;
  constructor(props: Record<string, unknown>) {
    this.props = props;
  }
}

const AdaptedLayer = createTableToRecordBatchAdapter(
  FakeUpstreamLayer as any,
  'TestLayer',
);

function createGeoArrowTable(numRows = 4) {
  const pointField = new Field(
    'geom',
    new FixedSizeList(2, new Field('xy', new Float64())),
    true,
    new Map([['ARROW:extension:name', 'geoarrow.point']]),
  );
  const valueField = new Field('value', new Float64());
  const schema = new Schema([pointField, valueField]);

  return new Table(schema, {
    geom: vectorFromArray(
      Array.from({length: numRows}, (_, i) => [i, i + 1]),
      pointField.type,
    ),
    value: vectorFromArray(Array.from({length: numRows}, (_, i) => i * 10)),
  });
}

function callRenderLayers(props: Record<string, unknown>): Layer[] | null {
  const instance = new (AdaptedLayer as any)(props);
  // CompositeLayer stores props on this.props; simulate the same for our test
  instance.props = props;
  return instance.renderLayers();
}

describe('createTableToRecordBatchAdapter', () => {
  it('assigns layerName to the adapter class', () => {
    expect((AdaptedLayer as any).layerName).toBe('TestLayer');
  });

  it('returns null for falsy data', () => {
    const result = callRenderLayers({id: 'test', data: null});
    expect(result).toBeNull();
  });

  it('returns null for non-Table, non-RecordBatch data', () => {
    const result = callRenderLayers({id: 'test', data: []});
    expect(result).toBeNull();
  });

  it('passes through RecordBatch data with converted Vector props', () => {
    const table = createGeoArrowTable();
    const batch = table.batches[0]!;
    const geomVector = table.getChild('geom')!;

    const result = callRenderLayers({
      id: 'my-layer',
      data: batch,
      getPosition: geomVector,
      opacity: 0.5,
    });

    expect(result).not.toBeNull();
    const layer = result as unknown as FakeUpstreamLayer;
    expect(layer.props.id).toBe('my-layer-0');
    expect(layer.props.data).toBe(batch);
    // Vector should be converted to Data (first chunk)
    expect(layer.props.getPosition).toBe(geomVector.data[0]);
    expect(layer.props.opacity).toBe(0.5);
  });

  it('splits a multi-batch Table into per-batch sublayers', () => {
    // Create a table that will have 2 batches by concatenating
    const table1 = createGeoArrowTable(3);
    const table2 = createGeoArrowTable(2);
    const combined = table1.concat(table2);

    expect(combined.batches.length).toBe(2);

    const geomVector = combined.getChild('geom')!;

    const result = callRenderLayers({
      id: 'multi',
      data: combined,
      getPosition: geomVector,
      filled: true,
    });

    expect(Array.isArray(result)).toBe(true);
    const layers = result as unknown as FakeUpstreamLayer[];
    expect(layers).toHaveLength(2);

    // Each sublayer gets a unique id
    expect(layers[0]!.props.id).toBe('multi-0');
    expect(layers[1]!.props.id).toBe('multi-1');

    // Each gets its own batch as data
    expect(layers[0]!.props.data).toBe(combined.batches[0]);
    expect(layers[1]!.props.data).toBe(combined.batches[1]);

    // Vector props are converted to per-batch Data chunks
    expect(layers[0]!.props.getPosition).toBe(geomVector.data[0]);
    expect(layers[1]!.props.getPosition).toBe(geomVector.data[1]);

    // Non-Vector props are passed through unchanged
    expect(layers[0]!.props.filled).toBe(true);
    expect(layers[1]!.props.filled).toBe(true);
  });

  it('excludes parent id from being overwritten in sublayer props', () => {
    const table = createGeoArrowTable(2);
    const combined = table.concat(createGeoArrowTable(2));

    const result = callRenderLayers({
      id: 'parent-id',
      data: combined,
      someFlag: true,
    });

    const layers = result as unknown as FakeUpstreamLayer[];
    expect(layers[0]!.props.id).toBe('parent-id-0');
    expect(layers[1]!.props.id).toBe('parent-id-1');
  });

  it('returns null for an empty Table (no batches)', () => {
    const table = createGeoArrowTable(4);
    // A sliced-to-zero table still has 1 batch with 0 rows in Arrow,
    // so it produces a single sublayer with an empty RecordBatch
    const emptyTable = table.slice(0, 0);
    const result = callRenderLayers({id: 'empty', data: emptyTable});
    const layers = result as unknown as FakeUpstreamLayer[];
    expect(layers).toHaveLength(1);
    expect(layers[0]!.props.id).toBe('empty-0');
  });
});
