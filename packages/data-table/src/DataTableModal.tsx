import {
  Button,
  Flex,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useDisclosure,
  useTheme,
} from '@chakra-ui/react';
import {FC} from 'react';
import QueryDataTable from './QueryDataTable';

type Props = {
  title: string | undefined;
  query: string | undefined;
  tableModal: ReturnType<typeof useDisclosure>;
};

const DataTableModal: FC<Props> = ({title, query, tableModal}) => {
  const theme = useTheme();

  return (
    <Modal
      isOpen={tableModal.isOpen}
      onClose={tableModal.onClose}
      isCentered
      // portalProps={{containerRef}}
    >
      <ModalOverlay backdropFilter={theme.backdropFilter} />
      <ModalContent height="80%" maxWidth={['90%', '85%', '80%', '75%']}>
        <ModalHeader>{title ? `Table "${title}"` : ''}</ModalHeader>
        <ModalCloseButton />
        <ModalBody
          bgColor="gray.700"
          flexGrow={1}
          display="flex"
          flexDir="column"
          overflow="hidden"
          p={0}
        >
          {tableModal.isOpen && query ? <QueryDataTable query={query} /> : null}
        </ModalBody>
        <ModalFooter>
          <Flex gap={3}>
            <Button variant="outline" onClick={tableModal.onClose}>
              Close
            </Button>
          </Flex>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default DataTableModal;
