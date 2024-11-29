import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
} from '@chakra-ui/react';
import React from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialName: string;
  onRename: (newName: string) => void;
}

const RenameSqlQueryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  initialName,
  onRename,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Rename Query</ModalHeader>
        <ModalCloseButton />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            onRename(formData.get('queryName') as string);
          }}
        >
          <ModalBody>
            <FormControl>
              <FormLabel>Query Name</FormLabel>
              <Input
                name="queryName"
                defaultValue={initialName}
                autoFocus
                placeholder="Enter query name"
              />
            </FormControl>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" colorScheme="blue">
              Save
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};

export default RenameSqlQueryModal; 