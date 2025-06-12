'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  SpinnerPane,
} from '@sqlrooms/ui';
import React, {Suspense, useCallback} from 'react';
import SqlEditor, {SqlEditorProps} from './SqlEditor';

/**
 * A modal wrapper for the SQL Editor component that provides a full-screen dialog interface.
 *
 * This component wraps the main SqlEditor component in a modal dialog, making it suitable for
 * overlay/popup usage scenarios. It inherits all props from SqlEditorProps and handles the
 * modal-specific behavior.
 *
 * @example
 * ```tsx
 * <SqlEditorModal
 *   isOpen={true}
 *   onClose={() => setIsOpen(false)}
 *   sqlEditorConfig={config}
 *   onChange={handleConfigChange}
 * />
 * ```
 *
 * @see {@link SqlEditor} for detailed documentation of all available props
 *
 * @see {@link SqlEditorProps}
 * The component accepts all props from SqlEditorProps:
 * - `isOpen` - Whether the SQL editor modal is currently visible
 * - `onClose` - Callback fired when the modal should be closed
 * - `sqlEditorConfig` - Configuration object containing queries and selected query state
 * - `onChange` - Callback fired when the SQL editor configuration changes
 * - `schema` - Optional database schema to use for queries (defaults to 'main')
 * - `documentationPanel` - Optional component to render SQL documentation in the side panel
 * - `onAddOrUpdateSqlQuery` - Callback fired when a new table should be created from query results
 */
const SqlEditorModal: React.FC<SqlEditorProps> = (props) => {
  const {isOpen, onClose} = props;

  // Memoize the handler to prevent re-renders
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onClose();
    },
    [onClose],
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogOverlay className="bg-background/80" />
      <DialogContent className="h-[100vh] max-h-[100vh] w-[100vw] max-w-[100vw] p-3">
        <DialogHeader className="sr-only">
          <DialogTitle>SQL Editor</DialogTitle>
          <DialogDescription>
            SQL editor for querying and managing database tables
          </DialogDescription>
        </DialogHeader>
        <Suspense fallback={<SpinnerPane h="100%" />}>
          <SqlEditor {...props} />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
};

export default SqlEditorModal;
