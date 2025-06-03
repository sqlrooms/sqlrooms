import {StateCreator} from 'zustand';
import {produce} from 'immer';
import {BaseProjectConfig, createSlice} from '@sqlrooms/project-builder';
import {S3Config} from '@sqlrooms/s3';
import {type Slice} from '@sqlrooms/project';

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
  PC extends BaseProjectConfig & S3Config,
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
