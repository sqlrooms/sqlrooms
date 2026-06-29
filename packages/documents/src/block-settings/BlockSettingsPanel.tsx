import {cn} from '@sqlrooms/ui';
import {createElement, FC, useContext} from 'react';
import type {Editor} from '@tiptap/react';
import {useSelectedBlockOrPanel} from './useSelectedBlockOrPanel';
import {useBlockSettings} from './useBlockSettings';
import {BlockDocumentEditorContext} from '../BlockDocumentEditor/BlockDocumentEditorContext';
import {SettingsErrorBoundary} from './SettingsErrorBoundary';

type SharedBlockSettingsPanelProps = {
  /** Additional CSS classes to apply to the panel */
  className?: string;
  /** Callback when the panel is closed */
  onClose?: () => void;
};

type ContextBackedBlockSettingsPanelProps = SharedBlockSettingsPanelProps & {
  /** TipTap editor from BlockDocumentEditorContext. */
  editor?: undefined;
  /** Document ID from BlockDocumentEditorContext. */
  documentId?: undefined;
};

type PropBackedBlockSettingsPanelProps = SharedBlockSettingsPanelProps & {
  /** TipTap editor instance (optional - can be passed explicitly or obtained from context) */
  editor: Editor | null;
  /**
   * Document ID required when providing an explicit editor prop.
   * Used to resolve selected TipTap block settings.
   */
  documentId: string;
};

export type BlockSettingsPanelProps =
  | ContextBackedBlockSettingsPanelProps
  | PropBackedBlockSettingsPanelProps;

/**
 * Panel that displays settings for the currently selected block.
 *
 * Automatically renders the settings component supplied by the selected
 * block or panel definition.
 *
 * Shows empty states for:
 * - No block selected
 * - No settings component available for the selected block
 *
 * @example
 * ```tsx
 * <div className="flex h-full">
 *   <div className="flex-1">
 *     <Dashboard />
 *   </div>
 *   <BlockSettingsPanel className="w-80 border-l" />
 * </div>
 * ```
 */
export const BlockSettingsPanel: FC<BlockSettingsPanelProps> = ({
  className,
  editor: editorProp,
  documentId: documentIdProp,
}) => {
  // Use editor and documentId from props if provided, otherwise try to get from context
  const editorContext = useContext(BlockDocumentEditorContext);
  const editor = editorProp ?? editorContext?.editor ?? null;
  const documentId = documentIdProp ?? editorContext?.documentId;

  const selectedItem = useSelectedBlockOrPanel(editor);
  const {SettingsComponent, settingsProps} = useBlockSettings(
    selectedItem,
    documentId,
  );

  // No selection or missing required props
  if (!settingsProps) {
    return (
      <div
        className={cn('flex h-full items-center justify-center p-4', className)}
      >
        <p className="text-muted-foreground text-sm">
          Select a block to edit settings
        </p>
      </div>
    );
  }

  // No settings component available for this block
  if (!SettingsComponent) {
    return (
      <div
        className={cn('flex h-full items-center justify-center p-4', className)}
      >
        <p className="text-muted-foreground text-sm">
          No settings available for this block
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <SettingsErrorBoundary key={settingsProps.blockId}>
        {createElement(SettingsComponent, settingsProps)}
      </SettingsErrorBoundary>
    </div>
  );
};
