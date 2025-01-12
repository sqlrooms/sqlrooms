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
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useTheme,
  useToast,
  useUpdateEffect,
} from '@chakra-ui/react';
import {SpinnerPane} from '@sqlrooms/components';
import {FC, Suspense, useCallback, useRef, useState} from 'react';
import {AddDataModalInternalContext} from './AddDataModalContext';
import UploadFiles from './upload/UploadFiles';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const AddDataModal: FC<Props> = (props) => {
  const {isOpen, onClose} = props;
  const [loadingStatus, setLoadingStatus] = useState<string>();
  const [canConfirm, setCanConfirm] = useState(false);

  const toast = useToast();
  const onError = useCallback(
    (message: string) => {
      // toast.closeAll();
      toast({
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    },
    [toast],
  );

  const handleConfirmRef = useRef<() => void>();
  const handleConfirm = useCallback(() => handleConfirmRef.current?.(), []);

  const handleCancelRef = useRef<() => void>();
  const handleCancel = useCallback(() => handleCancelRef.current?.(), []);

  useUpdateEffect(() => {
    // invoked only on update, not mount
    toast.closeAll();
  }, [isOpen]);

  const theme = useTheme();
  const [selectedTab, setSelectedTab] = useState(0);
  const [showTabs, setShowTabs] = useState(false);

  const tabs = [
    {
      title: 'Upload',
      panelProps: {pt: 0},
      content: () => <UploadFiles />,
      isDisabled: false,
    },
    // {
    //   title: 'Shared with me',
    //   isPro: true,
    //   isDisabled: true,
    //   content: () => null,
    // },
    // {
    //   title: 'External database',
    //   isPro: true,
    //   isDisabled: true,
    //   content: () => null,
    // },
    // {
    //   title: 'S3 bucket',
    //   isPro: true,
    //   isDisabled: true,
    //   content: () => null,
    // },
    // Run SQL Query
  ];

  return (
    <AddDataModalInternalContext.Provider
      value={{
        isOpen,
        onClose,
        onError,
        loadingStatus,
        onShowTabsChange: setShowTabs,
        onCanConfirmChange: setCanConfirm,
        onLoadingStatusChange: setLoadingStatus,
        onConfirmRef: handleConfirmRef,
        onCancelRef: handleCancelRef,
      }}
    >
      <Modal isOpen={isOpen} onClose={handleCancel} isCentered>
        <ModalOverlay backdropFilter={theme.backdropFilter} />
        <ModalContent height="80%" maxWidth={['90%', '85%', '80%', '75%']}>
          <Suspense fallback={<SpinnerPane h="100%" />}>
            <ModalHeader>Add Data Sources</ModalHeader>
            <ModalCloseButton isDisabled={Boolean(loadingStatus)} />
            <ModalBody
              flexGrow={1}
              display="flex"
              flexDir="column"
              overflow="hidden"
            >
              <Flex flexDir="column" flexGrow={1} gap={2} height="100%">
                <Tabs
                  index={selectedTab}
                  onChange={(index) => setSelectedTab(index)}
                  variant="line"
                  flexGrow={1}
                  display="flex"
                  flexDir="column"
                  height="100%"
                >
                  {showTabs ? (
                    <TabList>
                      {tabs.map((tab, i) => (
                        <Tab key={i} isDisabled={tab.isDisabled}>
                          {
                            /* tab.isPro ? (
                            <HStack>
                              <Text>{tab.title}</Text>
                              <Badge colorScheme="cyan">PRO</Badge>
                            </HStack>
                          ) : */ tab.title
                          }
                        </Tab>
                      ))}
                    </TabList>
                  ) : null}

                  <TabPanels
                    flexGrow={1}
                    display="flex"
                    flexDir="column"
                    height="100%"
                  >
                    {tabs.map((tab, i) => (
                      <TabPanel key={i} h="100%" {...tab.panelProps}>
                        <Suspense fallback={<SpinnerPane h="100%" />}>
                          {selectedTab === i ? (tab.content?.() ?? null) : null}
                        </Suspense>
                      </TabPanel>
                    ))}
                  </TabPanels>
                </Tabs>
              </Flex>
              {loadingStatus ? (
                <SpinnerPane
                  width="100%"
                  height="100%"
                  alignItems="center"
                  position="absolute"
                  top="0"
                  bg="gray.700"
                  zIndex={3}
                >
                  <Text fontSize="sm" color="gray.500">
                    {loadingStatus}
                  </Text>
                </SpinnerPane>
              ) : null}
            </ModalBody>
            <ModalFooter>
              <Button
                mr={3}
                onClick={handleCancel}
                isDisabled={Boolean(loadingStatus)}
              >
                Cancel
              </Button>
              <Button
                colorScheme="blue"
                mr={3}
                onClick={handleConfirm}
                isDisabled={Boolean(loadingStatus) || !canConfirm}
              >
                Add Data
              </Button>
            </ModalFooter>
          </Suspense>
        </ModalContent>
      </Modal>
    </AddDataModalInternalContext.Provider>
  );
};
export default AddDataModal;
