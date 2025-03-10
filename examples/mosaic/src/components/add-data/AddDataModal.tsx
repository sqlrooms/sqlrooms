import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  SpinnerPane,
  useToast,
} from '@sqlrooms/ui';
import {FC, Suspense, useCallback, useRef, useState} from 'react';
import {AddDataModalInternalContext} from './AddDataModalContext';
import UploadFiles from './upload/UploadFiles';

const AddDataModal: FC<{
  isOpen: boolean;
  onClose: () => void;
}> = (props) => {
  const {isOpen, onClose} = props;
  const [loadingStatus, setLoadingStatus] = useState<string>();
  const [canConfirm, setCanConfirm] = useState(false);
  const [selectedTab, setSelectedTab] = useState('upload');
  const [showTabs, setShowTabs] = useState(false);
  const {toast} = useToast();

  const onError = useCallback(
    (message: string) => {
      toast({
        variant: 'destructive',
        description: message,
      });
    },
    [toast],
  );

  const handleConfirmRef = useRef<() => void>();
  const handleConfirm = useCallback(() => handleConfirmRef.current?.(), []);

  const handleCancelRef = useRef<() => void>();
  const handleCancel = useCallback(() => handleCancelRef.current?.(), []);

  const tabs = [
    {
      id: 'upload',
      title: 'Upload',
      content: () => <UploadFiles />,
      isDisabled: false,
    },
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
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="h-[80vh] max-w-[75vw]">
          <Suspense fallback={<SpinnerPane h="100%" />}>
            <DialogHeader>
              <DialogTitle>Add Data Sources</DialogTitle>
            </DialogHeader>

            <div className="flex h-full flex-grow flex-col gap-2 overflow-hidden">
              <Tabs
                value={selectedTab}
                onValueChange={setSelectedTab}
                className="flex h-full flex-grow flex-col"
              >
                {showTabs ? (
                  <TabsList>
                    {tabs.map((tab) => (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        disabled={tab.isDisabled}
                      >
                        {tab.title}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                ) : null}

                {tabs.map((tab) => (
                  <TabsContent
                    key={tab.id}
                    value={tab.id}
                    className="h-full flex-grow"
                  >
                    <Suspense fallback={<SpinnerPane h="100%" />}>
                      {selectedTab === tab.id ? tab.content() : null}
                    </Suspense>
                  </TabsContent>
                ))}
              </Tabs>
            </div>

            {loadingStatus ? (
              <div className="bg-background/80 absolute inset-0 flex items-center justify-center">
                <SpinnerPane>
                  <span className="text-muted-foreground text-sm">
                    {loadingStatus}
                  </span>
                </SpinnerPane>
              </div>
            ) : null}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={Boolean(loadingStatus)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={Boolean(loadingStatus) || !canConfirm}
              >
                Add Data
              </Button>
            </DialogFooter>
          </Suspense>
        </DialogContent>
      </Dialog>
    </AddDataModalInternalContext.Provider>
  );
};

export default AddDataModal;
