import {Button} from '@sqlrooms/ui';
import {SparklesIcon} from 'lucide-react';
import type {ReactNode} from 'react';
import {
  BlockAiPromptPopover,
  type BlockAiPromptPopoverProps,
} from './BlockAiPromptPopover';

/**
 * Structural block header context used by the shared Ask AI header action.
 * Matches the documents package header-actions render context without importing it.
 */
export type AskAiBlockHeaderActionRenderContext = {
  blockDocumentId: string;
  blockId: string;
  blockType: string;
  blockInstanceId?: string;
};

export type CreateAskAiBlockHeaderActionOptions = {
  /**
   * Interim gate for which block types show Ask AI.
   * Stage 6 of the sharing plan replaces this with a per-block-type registry.
   */
  supportsAiEditing: (blockType: string) => boolean;
  onSubmit: (ctx: AskAiBlockHeaderActionRenderContext, prompt: string) => void;
  label?: string;
  placeholder?: string;
  popoverProps?: Omit<
    BlockAiPromptPopoverProps,
    'trigger' | 'onSubmit' | 'label' | 'placeholder'
  >;
};

/**
 * Builds a block-header actions renderer that shows the shared Ask AI popover
 * for block types that support AI editing.
 */
export function createAskAiBlockHeaderAction({
  supportsAiEditing,
  onSubmit,
  label = 'Ask AI',
  placeholder = 'Ask AI to edit this block...',
  popoverProps,
}: CreateAskAiBlockHeaderActionOptions): (
  ctx: AskAiBlockHeaderActionRenderContext,
) => ReactNode {
  function AskAiBlockHeaderAction(
    ctx: AskAiBlockHeaderActionRenderContext,
  ): ReactNode {
    if (!supportsAiEditing(ctx.blockType)) {
      return null;
    }

    return (
      <BlockAiPromptPopover
        label={label}
        placeholder={placeholder}
        trigger={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            aria-label={label}
            title={label}
          >
            <SparklesIcon className="h-3.5 w-3.5" aria-hidden />
          </Button>
        }
        onSubmit={(prompt) => onSubmit(ctx, prompt)}
        {...popoverProps}
      />
    );
  }

  return AskAiBlockHeaderAction;
}
