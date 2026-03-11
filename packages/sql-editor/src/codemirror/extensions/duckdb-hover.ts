import {hoverTooltip} from '@codemirror/view';
import type {EditorView} from '@codemirror/view';
import type {Extension} from '@codemirror/state';
import {syntaxTree} from '@codemirror/language';
import {type DuckDbConnector, getFunctionDocumentation} from '@sqlrooms/duckdb';
import {FunctionDocumentation} from '../../components/FunctionDocumentation';
import {renderComponentToString} from '@sqlrooms/utils';

interface DuckDbHoverContext {
  connector?: DuckDbConnector;
}

/**
 * Creates a hover tooltip extension for DuckDB functions.
 * Shows function signatures, descriptions, and examples on hover.
 */
export function createDuckDbHover(context: DuckDbHoverContext): Extension {
  if (!context.connector) {
    return [];
  }

  return hoverTooltip(async (view: EditorView, pos: number, side) => {
    const {connector} = context;
    if (!connector) {
      return null;
    }

    // Get the syntax node at cursor position
    const tree = syntaxTree(view.state);
    const node = tree.resolveInner(pos, side);

    // Check if we're hovering over a function call, identifier, or keyword
    // Some DuckDB functions are keywords (CAST, EXTRACT, etc.)
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
      const functionGroup = await getFunctionDocumentation(connector, word);

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
      console.error('Error fetching DuckDB function hover info:', error);
      return null;
    }
  });
}
