import {
  HStack,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Progress,
  Spacer,
  Text,
  VStack,
} from '@chakra-ui/react';
import {FC} from 'react';

type Props = {
  isOpen: boolean;
  title?: string;
  loadingStage?: string;
  progress?: number;
};
const ProgressModal: FC<Props> = (props) => {
  const {isOpen, title, loadingStage, progress} = props;
  if (!isOpen) {
    return null;
  }
  return (
    // <Delayed delay={300}>
    <Modal
      isCentered
      isOpen={isOpen}
      onClose={() => {
        // do nothing
      }}
      motionPreset="none"
    >
      {/* <ModalOverlay /> */}
      <ModalContent>
        <ModalHeader fontSize="md" pb={0}>
          {title ?? ''}
        </ModalHeader>
        <ModalBody>
          <VStack gap={1} alignItems="stretch">
            <Progress
              value={progress}
              isIndeterminate={progress === undefined || progress === 0}
            />
            <HStack alignSelf="stretch" fontSize="xs">
              <Text>{loadingStage ?? ''}</Text>
              <Spacer />
              {progress ? <Text>{progress}%</Text> : null}
            </HStack>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
    // </Delayed>
  );
};

export default ProgressModal;
