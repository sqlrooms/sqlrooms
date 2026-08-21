import {Children, isValidElement, type ReactNode} from 'react';
import {InlineApiKeyInput} from '../InlineApiKeyInput';
import {ContextSelector} from '../context/ContextSelector';
import {CHAT_CONTEXT_SELECTOR_SLOT} from '../context/types';

/**
 * Legacy `children` routing for `QueryControls`, kept whole in one file so it
 * can be deleted in one move.
 *
 * @deprecated Identity-check routing silently breaks when a host wraps a child
 * in `memo`, `lazy`, a fragment, or its own abstraction. Kept only so existing
 * `QueryControls` consumers keep working. New composers render the composer
 * primitives (`Chat.Composer.Input`, `.Send`, `.Stop`, `.DropTarget`) directly,
 * and a credential gate branches on `useChatComposer()`'s `needsApiKey`.
 */
export type InlineApiKeyInputElement = React.ReactElement<
  React.ComponentProps<typeof InlineApiKeyInput>
>;

/** @deprecated See {@link extractComposerChildren}. */
function isInlineApiKeyInput(
  child: ReactNode,
): child is InlineApiKeyInputElement {
  return isValidElement(child) && child.type === InlineApiKeyInput;
}

/** @deprecated See {@link extractComposerChildren}. */
function isContextSelector(child: ReactNode): child is React.ReactElement {
  if (!isValidElement(child)) return false;
  if (child.type === ContextSelector) return true;
  return (
    typeof child.type !== 'string' &&
    Boolean(
      (child.type as {[CHAT_CONTEXT_SELECTOR_SLOT]?: boolean})[
        CHAT_CONTEXT_SELECTOR_SLOT
      ],
    )
  );
}

/**
 * Splits `children` into the inline API-key input, context selectors, and
 * everything else.
 *
 * @deprecated See the module doc.
 */
export function extractComposerChildren(children: ReactNode): {
  inlineApiKeyInput: InlineApiKeyInputElement | null;
  contextSelectors: ReactNode[];
  otherChildren: ReactNode[];
} {
  let inlineApiKeyInput: InlineApiKeyInputElement | null = null;
  const contextSelectors: ReactNode[] = [];
  const otherChildren: ReactNode[] = [];

  Children.forEach(children, (child) => {
    if (isInlineApiKeyInput(child)) {
      inlineApiKeyInput = child;
    } else if (isContextSelector(child)) {
      contextSelectors.push(child);
    } else {
      otherChildren.push(child);
    }
  });

  return {inlineApiKeyInput, contextSelectors, otherChildren};
}
