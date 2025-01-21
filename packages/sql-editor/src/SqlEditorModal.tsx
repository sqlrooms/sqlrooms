'use client';

import {Modal, ModalBody, ModalContent, ModalOverlay} from '@chakra-ui/react';
import {SpinnerPane} from '@sqlrooms/ui';
import React, {Suspense} from 'react';
import SqlEditor, {Props} from './SqlEditor';

const SqlEditorModal: React.FC<Props> = (props) => {
  const {isOpen, onClose} = props;
  return (
    <>
      <Modal
        isCentered
        isOpen={isOpen}
        onClose={onClose}
        closeOnOverlayClick={false}
        size={'full'}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalBody display="flex" alignItems="stretch" px={3} pt={3} pb={1}>
            <Suspense fallback={<SpinnerPane h="100%" />}>
              <SqlEditor {...props} />
            </Suspense>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};

export default SqlEditorModal;
