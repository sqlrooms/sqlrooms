import {createContext, MutableRefObject} from 'react';

export type AddDataModalInternalContextType = {
  isOpen: boolean;
  loadingStatus: string | undefined;
  onShowTabsChange: (showTabs: boolean) => void;
  onClose: () => void;
  onError: (message: string) => void;
  onLoadingStatusChange: (message: string | undefined) => void;
  onCanConfirmChange: (canConfirm: boolean) => void;
  // Provide parent with a callback to call on cancel
  onCancelRef: MutableRefObject<(() => void) | undefined>;
  // Provide parent with a callback to call on confirm
  onConfirmRef: MutableRefObject<(() => void) | undefined>;
};

export const AddDataModalInternalContext =
  createContext<AddDataModalInternalContextType>({
    isOpen: false,
    loadingStatus: undefined,
    onShowTabsChange: () => {
      // do nothing
    },
    onClose: () => {
      // do nothing
    },
    onError: () => {
      // do nothing
    },
    onLoadingStatusChange: () => {
      // do nothing
    },
    onCanConfirmChange: () => {
      // do nothing
    },
    onCancelRef: {current: undefined},
    onConfirmRef: {current: undefined},
  });
