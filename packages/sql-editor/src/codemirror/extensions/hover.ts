import {hoverTooltip} from '@codemirror/view';
import type {EditorView} from '@codemirror/view';
import type {Extension} from '@codemirror/state';
import {syntaxTree} from '@codemirror/language';
import {FunctionDocumentation} from '../../components/FunctionDocumentation';
import {renderComponentToString} from '@sqlrooms/utils';
import type {GroupedFunctionSuggestion} from '@sqlrooms/db';

export interface HoverContext {
  getFunctionDocumentation?: (
    functionName: string,
  ) => Promise<GroupedFunctionSuggestion | null>;
}

/**
 * Creates a hover tooltip extension for SQL functions.
 * Shows function signatures, descriptions, and examples on hover.
 */
export function createHover(context: HoverContext): Extension {
  return hoverTooltip(async (view: EditorView, pos: number, side) => {
    const {getFunctionDocumentation} = context;
    if (!getFunctionDocumentation) {
      return null;
    }

    // Get the syntax node at cursor position
    const tree = syntaxTree(view.state);
    const node = tree.resolveInner(pos, side);

    // Check if we're hovering over a function call, identifier, or keyword
    // Some SQL functions are keywords (CAST, EXTRACT, etc.)
    if (!node || (node.name !== 'Identifier' && node.name !== 'Keyword')) {
      return null;
    }

    // Get the word at the cursor position
    const word = view.state.doc.sliceString(node.from, node.to);
    if (!word || word.length === 0) {
      return null;
    }

    try {
      // Fetch exact function documentation
      const functionGroup = await getFunctionDocumentation(word);

      if (!functionGroup) {
        return null;
      }

      // Create tooltip DOM element
      const dom = document.createElement('div');
      dom.innerHTML = renderComponentToString(FunctionDocumentation, {
        functions: functionGroup.overloads,
      });

      return {
        pos: node.from,
        end: node.to,
        above: true,
        create: () => ({dom}),
      };
    } catch (error) {
      console.error('Error fetching function hover info:', error);
      return null;
    }
  });
}
