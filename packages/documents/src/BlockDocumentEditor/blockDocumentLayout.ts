/**
 * Shared horizontal layout metrics for the block document editor surface.
 *
 * The document content is padded equally on both sides so it reads as a
 * centred column. The left half of that padding doubles as the gutter the
 * floating block controls (add + drag handle) hover in, which is why the
 * gutter is derived from the controls' own footprint rather than picked by
 * eye — see {@link BLOCK_DOCUMENT_CONTENT_GUTTER}.
 *
 * Only *horizontal* metrics live here, because those are what the content box
 * and the overlay have to agree on. The controls' vertical positioning is
 * private to `BlockDocumentBlockControls`.
 */

/** Left inset (px) of the floating block controls stack inside the gutter. */
export const BLOCK_DOCUMENT_CONTROLS_LEFT_INSET = 4;

/**
 * Width (px) of the block controls stack: two 28px icon buttons separated by
 * a 2px gap. Mirrors the `h-7 w-7` / `gap-0.5` classes used to render it, so
 * it has to be updated by hand if those change.
 */
const BLOCK_DOCUMENT_CONTROLS_STACK_WIDTH = 58;

/** Breathing room (px) left between the controls stack and the text column. */
const BLOCK_DOCUMENT_CONTROLS_TEXT_CLEARANCE = 10;

/**
 * Horizontal padding (px) applied to *both* sides of the document content.
 *
 * Derived from what the left gutter has to hold, then mirrored on the right:
 * an asymmetric pair is what pushed the document off-centre previously.
 */
export const BLOCK_DOCUMENT_CONTENT_GUTTER =
  BLOCK_DOCUMENT_CONTROLS_LEFT_INSET +
  BLOCK_DOCUMENT_CONTROLS_STACK_WIDTH +
  BLOCK_DOCUMENT_CONTROLS_TEXT_CLEARANCE;

/**
 * Class name applied to the ProseMirror content element.
 *
 * Horizontal padding is written as a single `px-*` utility so the two sides
 * cannot drift apart. Tailwind only scans static text, so the pixel value is
 * spelled out here and `blockDocumentLayout.test.ts` checks it still matches
 * {@link BLOCK_DOCUMENT_CONTENT_GUTTER}, which the overlay geometry uses.
 */
export const BLOCK_DOCUMENT_CONTENT_CLASS_NAME = [
  'prose prose-sm dark:prose-invert prose-a:text-primary prose-a:underline-offset-2',
  'prose-headings:tracking-normal prose-h1:my-3 prose-h1:text-2xl prose-h1:leading-tight',
  'prose-h2:my-2 prose-h2:text-xl prose-h2:leading-snug prose-h3:my-2 prose-h3:text-lg prose-h3:leading-snug',
  'prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-li:leading-6',
  'prose-code:before:content-none prose-code:after:content-none',
  'prose-pre:bg-muted prose-pre:text-foreground prose-pre:my-3 prose-pre:rounded-md prose-pre:px-3 prose-pre:py-2',
  '[&_li>p]:my-0 [&>p]:min-h-6',
  '[&>h1[data-type=block-document-title]]:!my-0 [&>h1[data-type=block-document-title]]:!text-4xl [&>h1[data-type=block-document-title]]:!leading-tight',
  'max-w-none min-h-full pt-10 pb-5 focus:outline-none',
  'px-[72px]',
].join(' ');
