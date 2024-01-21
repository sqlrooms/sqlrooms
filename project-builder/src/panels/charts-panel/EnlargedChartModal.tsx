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
} from '@chakra-ui/react';
import {ChartConfig} from '@flowmapcity/project-config';
import {FC} from 'react';
import ChartView from './ChartView';
type Props = {
  chart?: ChartConfig;
  onClose: () => void;
};
const EnlargedChartModal: FC<Props> = (props) => {
  const {chart, onClose} = props;
  const chartModal = useDisclosure({
    isOpen: Boolean(chart),
  });
  return (
    <Modal
      size={'3xl'}
      isOpen={chartModal.isOpen}
      onClose={onClose}
      isCentered={true}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{chart?.title}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>{chart ? <ChartView chart={chart} /> : null}</ModalBody>
        <ModalFooter>
          <Flex gap={3}>
            <Button colorScheme="blue" onClick={onClose}>
              Close
            </Button>
          </Flex>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default EnlargedChartModal;
