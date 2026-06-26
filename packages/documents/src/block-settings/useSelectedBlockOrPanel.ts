import {useEffect, useState} from 'react';
import type {Editor} from '@tiptap/react';
import {NodeSelection} from '@tiptap/pm/state';
import {useBlockSettingsStore} from './useBlockSettingsStore';
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

type EditorSelection = {
  blockType: string;
  blockId: string;
  attrs: Record<string, any>;
} | null;

/**
 * Extracts block type from a TipTap node.
 * Returns null if the block type cannot be determined.
 */
function getBlockTypeFromNode(node: {
  type: {name: string};
  attrs: Record<string, any>;
}): string | null {
  const nodeType = node.type.name;

  if (nodeType === 'blockDocumentStatefulBlock') {
    // Stateful blocks (dashboard, data table, map, etc.) have blockType in attrs
    return node.attrs.blockType || null;
  }

  if (nodeType === 'blockDocumentChart') {
    // Chart blocks are identified by node type
    return 'chart-block';
  }

  // Unknown block type
  return null;
}

/**
 * Extracts editor selection from TipTap editor state.
 * Returns null if no block is selected or block type cannot be determined.
 */
function getEditorSelection(editor: Editor): EditorSelection {
  const {selection} = editor.state;

  // Check if this is a NodeSelection (block selected)
  if (!(selection instanceof NodeSelection)) {
    return null;
  }

  const {node} = selection;
  const blockId = node.attrs.id;

  if (!blockId) return null;

  const blockType = getBlockTypeFromNode(node);
  if (!blockType) return null;

  return {
    blockType,
    blockId,
    attrs: node.attrs,
  };
}

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
  const panelSelection = useBlockSettingsStore(
    (state) => state.blockSettings.config.selectedBlock,
  );
  const clearSelection = useBlockSettingsStore(
    (state) => state.blockSettings.clearSelection,
  );

  // Initialize state from editor
  const [editorSelection, setEditorSelection] = useState<EditorSelection>(() =>
    editor ? getEditorSelection(editor) : null,
  );

  useEffect(() => {
    if (!editor) {
      return;
    }

    const updateSelection = () => {
      const selection = getEditorSelection(editor);
      setEditorSelection(selection);

      // If NodeSelection appeared in TipTap, clear any panel selection
      // This ensures only one selection is active at a time
      if (selection && panelSelection) {
        clearSelection();
      }
    };

    // Subscribe to updates (initial value already set via useState initializer)
    editor.on('selectionUpdate', updateSelection);

    return () => {
      editor.off('selectionUpdate', updateSelection);
    };
  }, [editor, panelSelection, clearSelection]);

  // Priority 1: Panel selection
  if (panelSelection) {
    return {
      type: 'panel',
      selectedBlock: panelSelection,
    };
  }

  // Priority 2: Block selection from TipTap
  if (editorSelection) {
    return {
      type: 'block',
      ...editorSelection,
    };
  }

  return null;
}
