import {useMemo} from 'react';
import type {Editor} from '@tiptap/react';
import {useBlockSelection} from './useBlockSelection';
import type {SelectedBlock} from './types';

export type SelectedItem =
  | {
      type: 'block';
      blockType: string;
      blockId: string;
      attrs: Record<string, any>;
    }
  | {type: 'panel'; selectedBlock: SelectedBlock}
  | null;

/**
 * Hook that returns the currently selected block or panel.
 *
 * Priority order:
 * 1. Panel selection from blockSelection store (custom selection)
 * 2. Block selection from TipTap editor state (node selection)
 * 3. null if neither is selected
 *
 * @param editor - TipTap editor instance
 * @returns Selected block/panel info or null
 */
export function useSelectedBlockOrPanel(editor: Editor | null): SelectedItem {
  // Check panel selection first (higher priority)
  const panelSelection = useBlockSelection(
    (state) => state.blockSelection.config.selectedBlock,
  );

  return useMemo(() => {
    // Priority 1: Panel selection
    if (panelSelection) {
      return {
        type: 'panel',
        selectedBlock: panelSelection,
      };
    }

    // Priority 2: Block selection from TipTap
    if (!editor) {
      return null;
    }

    const {selection} = editor.state;

    // Check if it's a NodeSelection (not TextSelection or AllSelection)
    // @ts-expect-error - NodeSelection has node property
    if (!selection.node) {
      return null;
    }

    // @ts-expect-error - NodeSelection has node property
    const {node} = selection;

    // Extract blockType from node attributes
    const blockType = node.attrs.blockType;
    const blockId = node.attrs.id;

    if (!blockType || !blockId) {
      return null;
    }

    return {
      type: 'block',
      blockType,
      blockId,
      attrs: node.attrs,
    };
  }, [panelSelection, editor]);
}
