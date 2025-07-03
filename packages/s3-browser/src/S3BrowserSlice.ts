import {StateCreator} from 'zustand';
import {produce} from 'immer';
import {type Slice, BaseRoomConfig, createSlice} from '@sqlrooms/room-shell';
import {S3Config} from '../../s3-browser-config/dist';

export type S3BrowserState = Slice & {
  s3Browser: {
    // current in credential form
    currentS3Config: S3Config | null;
    // Credential management
    setCurrentS3Config: (s3Config: S3Config) => void;
    clearCurrentS3Config: () => void;
  };
};

// Create the store
export function createS3BrowserSlice<
  PC extends BaseRoomConfig & S3Config,
>(): StateCreator<S3BrowserState> {
  return createSlice<PC, S3BrowserState>((set) => ({
    // Initial state
    s3Browser: {
      currentS3Config: null,

      // Actions
      setCurrentS3Config: (s3Config) => {
        set((state) =>
          produce(state, (draft) => {
            draft.s3Browser.currentS3Config = s3Config;
          }),
        );
      },
      clearCurrentS3Config: () => {
        set((state) =>
          produce(state, (draft) => {
            draft.s3Browser.currentS3Config = null;
          }),
        );
      },
    },
  }));
}
