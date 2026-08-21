import {isBlockDocumentStatefulBlockTypeEnabled} from '../src/BlockDocumentStatefulBlockRendererContext';

describe('isBlockDocumentStatefulBlockTypeEnabled', () => {
  const blockTypes = [{blockType: 'map'}, {blockType: 'dashboard'}];

  it('recognizes enabled and disabled persisted stateful block types', () => {
    expect(isBlockDocumentStatefulBlockTypeEnabled(blockTypes, 'map')).toBe(
      true,
    );
    expect(
      isBlockDocumentStatefulBlockTypeEnabled(blockTypes, 'data-table'),
    ).toBe(false);
    expect(isBlockDocumentStatefulBlockTypeEnabled(blockTypes, '')).toBe(false);
  });
});
