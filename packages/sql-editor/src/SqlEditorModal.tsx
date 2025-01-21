'use client';

import {SpinnerPane} from '@sqlrooms/ui';
import {Dialog, DialogContent, DialogOverlay} from '@sqlrooms/ui';
import React, {Suspense} from 'react';
import SqlEditor, {Props} from './SqlEditor';

const SqlEditorModal: React.FC<Props> = (props) => {
  const {isOpen, onClose} = props;
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogOverlay className="bg-background/80" />
      <DialogContent className="max-w-[100vw] max-h-[100vh] w-[100vw] h-[100vh] p-3">
        <Suspense fallback={<SpinnerPane h="100%" />}>
          <SqlEditor {...props} />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
};

export default SqlEditorModal;
