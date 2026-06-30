import {Button, cn} from '@sqlrooms/ui';
import {XIcon} from 'lucide-react';
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

type BlockSettingsEmptyStateProps = {
  className?: string;
  message: string;
  onClose?: () => void;
  showCloseButton?: boolean;
};

const BlockSettingsEmptyState: FC<BlockSettingsEmptyStateProps> = ({
  className,
  message,
  onClose,
  showCloseButton,
}) => {
  return (
    <div
      className={cn(
        'relative flex h-full min-h-full flex-col items-center justify-center gap-2 p-4',
        className,
      )}
    >
      {onClose && showCloseButton ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6"
          aria-label="Close settings panel"
          onClick={onClose}
        >
          <XIcon className="h-3.5 w-3.5" aria-hidden />
        </Button>
      ) : null}
      <p className="text-muted-foreground text-sm">{message}</p>
      {onClose ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Close settings panel"
          onClick={onClose}
        >
          Close settings
        </Button>
      ) : null}
    </div>
  );
};

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
  onClose,
}) => {
  // Use editor and documentId from props if provided, otherwise try to get from context
  const editorContext = useContext(BlockDocumentEditorContext);
  const editor = editorProp ?? editorContext?.editor ?? null;
  const documentId = documentIdProp ?? editorContext?.documentId;
  const readOnly =
    editorContext?.readOnly ?? (editor ? !editor.isEditable : undefined);

  const selectedItem = useSelectedBlockOrPanel(editor);
  const {SettingsComponent, settingsProps} = useBlockSettings(
    selectedItem,
    documentId,
    readOnly,
  );

  // No selection or missing required props
  if (!settingsProps) {
    return (
      <BlockSettingsEmptyState
        className={className}
        message="Select a block to edit settings"
        onClose={onClose}
        showCloseButton
      />
    );
  }

  // No settings component available for this block
  if (!SettingsComponent) {
    return (
      <BlockSettingsEmptyState
        className={className}
        message="No settings available for this block"
        onClose={onClose}
      />
    );
  }

  return (
    <div className={className}>
      <SettingsErrorBoundary key={settingsProps.blockId}>
        {createElement(SettingsComponent, {...settingsProps, onClose})}
      </SettingsErrorBoundary>
    </div>
  );
};
