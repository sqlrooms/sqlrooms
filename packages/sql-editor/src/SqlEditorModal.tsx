import { Modal, ModalBody, ModalContent, ModalOverlay } from '@chakra-ui/react';
import { AppContext, SpinnerPane } from '@sqlrooms/components';
import React, { Suspense, useContext } from 'react';
import SqlEditor, { Props } from './SqlEditor';


const SqlEditorModal: React.FC<Props> = (props) => {
  const {isOpen, onClose} = props;
  const appContext = useContext(AppContext);
  return (
    <>
      <Modal
        isCentered
        isOpen={isOpen}
        onClose={onClose}
        closeOnOverlayClick={false}
        size={'full'}
        preserveScrollBarGap={appContext.mode === 'sdk'} // to avoid layout jumping and CSS added to host document
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
