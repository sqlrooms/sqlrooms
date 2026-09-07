import {
  blockContextItemId,
  defaultBlockTitle,
  parseBlockContextItemId,
  type BlockAiTarget,
} from '../src/BlockAiTarget';

describe('BlockAiTarget helpers', () => {
  it('round-trips block context item ids without panel ids', () => {
    const target: BlockAiTarget = {
      blockDocumentId: 'document-1',
      blockId: 'block-1',
      blockType: 'chart',
    };

    expect(parseBlockContextItemId(blockContextItemId(target))).toEqual({
      blockDocumentId: 'document-1',
      blockId: 'block-1',
    });
  });

  it('round-trips block context item ids with panel ids', () => {
    const target: BlockAiTarget = {
      blockDocumentId: 'document-1',
      blockId: 'block-1',
      blockType: 'dashboard',
      panelId: 'panel-1',
    };

    expect(parseBlockContextItemId(blockContextItemId(target))).toEqual({
      blockDocumentId: 'document-1',
      blockId: 'block-1',
      panelId: 'panel-1',
    });
  });

  it('preserves separators, spaces, and unicode through context item ids', () => {
    const target: BlockAiTarget = {
      blockDocumentId: 'doc:with spaces/東京',
      blockId: 'block:with spaces/ Zürich',
      blockType: 'dashboard',
      panelId: 'panel:with spaces/🙂',
    };

    expect(parseBlockContextItemId(blockContextItemId(target))).toEqual({
      blockDocumentId: target.blockDocumentId,
      blockId: target.blockId,
      panelId: target.panelId,
    });
  });

  it.each(['', 'block', 'block:a', 'notblock:a:b', 'block:a:b:c:d'])(
    'returns undefined for malformed id %p',
    (id) => {
      expect(parseBlockContextItemId(id)).toBeUndefined();
    },
  );

  it('returns undefined for malformed encoded components', () => {
    expect(parseBlockContextItemId('block:%E0%A4%A:block-1')).toBeUndefined();
  });

  it('encodes an explicitly provided empty panel id', () => {
    const target: BlockAiTarget = {
      blockDocumentId: 'document-1',
      blockId: 'block-1',
      blockType: 'dashboard',
      panelId: '',
    };

    expect(blockContextItemId(target)).toBe('block:document-1:block-1:');
    expect(parseBlockContextItemId(blockContextItemId(target))).toEqual({
      blockDocumentId: 'document-1',
      blockId: 'block-1',
      panelId: '',
    });
  });

  it('uses explicit titles and host-provided block labels', () => {
    const resolveLabel = (blockType: string) =>
      ({
        chart: 'Chart',
        dashboard: 'Dashboard',
        'html-app': 'HTML app',
      })[blockType];

    expect(defaultBlockTitle('chart', {resolveLabel})).toBe('Chart');
    expect(defaultBlockTitle('dashboard', {resolveLabel})).toBe('Dashboard');
    expect(defaultBlockTitle('html-app', {resolveLabel})).toBe('HTML app');
    expect(
      defaultBlockTitle('chart', {
        title: '  Revenue over time  ',
        resolveLabel,
      }),
    ).toBe('Revenue over time');
  });

  it('falls back to host labels or title-cased block types for empty titles', () => {
    expect(
      defaultBlockTitle('chart', {
        title: '   ',
        resolveLabel: (blockType) =>
          blockType === 'chart' ? 'Chart' : undefined,
      }),
    ).toBe('Chart');
    expect(defaultBlockTitle('custom-viz_block')).toBe('Custom Viz Block');
    expect(defaultBlockTitle('')).toBe('Block');
  });
});
