import {createSlice} from '@sqlrooms/room-shell';
import {produce} from 'immer';
import {StateCreator} from 'zustand';
import {S3Config} from '@sqlrooms/s3-browser-config';

export type S3BrowserState = {
  s3Browser: {
    // current in credential form
    currentS3Config: S3Config | null;
    // Credential management
    setCurrentS3Config: (s3Config: S3Config) => void;
    clearCurrentS3Config: () => void;
  };
};

// Create the store
export function createS3BrowserSlice(): StateCreator<S3BrowserState> {
  return createSlice<S3BrowserState>((set) => ({
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
