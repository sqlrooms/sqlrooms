'use client';

import {SpinnerPane} from '@sqlrooms/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from '@sqlrooms/ui';
import React, {Suspense} from 'react';
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
 * @props {@link SqlEditorProps}
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
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogOverlay className="bg-background/80" />
      <DialogContent className="max-w-[100vw] max-h-[100vh] w-[100vw] h-[100vh] p-3">
        <DialogHeader className="sr-only">
          <DialogTitle>SQL Editor</DialogTitle>
        </DialogHeader>
        <Suspense fallback={<SpinnerPane h="100%" />}>
          <SqlEditor {...props} />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
};

export default SqlEditorModal;
