import {
  BLOCK_DOCUMENT_CONTENT_CLASS_NAME,
  BLOCK_DOCUMENT_CONTENT_GUTTER,
} from '../src/BlockDocumentEditor/blockDocumentLayout';

function horizontalPaddingClasses() {
  return BLOCK_DOCUMENT_CONTENT_CLASS_NAME.split(/\s+/).filter((candidate) =>
    /^-?p[lrxse]-/.test(candidate),
  );
}

describe('block document layout', () => {
  // Tailwind only scans static text, so the content padding repeats the pixel
  // value the overlay geometry reads from BLOCK_DOCUMENT_CONTENT_GUTTER. If
  // the two drift, the drag-drop indicator stops lining up with the text.
  it('pads the content by the gutter the block controls overlay assumes', () => {
    expect(horizontalPaddingClasses()).toEqual([
      `px-[${BLOCK_DOCUMENT_CONTENT_GUTTER}px]`,
    ]);
  });

  it('leaves no room for an asymmetric override to creep back in', () => {
    const asymmetric = horizontalPaddingClasses().filter(
      (candidate) => !candidate.startsWith('px-'),
    );
    expect(asymmetric).toEqual([]);
  });
});
