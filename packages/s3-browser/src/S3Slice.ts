import {StateCreator} from 'zustand';
import {produce} from 'immer';
import {BaseProjectConfig, createSlice} from '@sqlrooms/project-builder';
import {S3Config} from '@sqlrooms/s3';
import {type Slice} from '@sqlrooms/project';

export type S3State = Slice & {
  s3: {
    // current in credential form
    currentS3Config: S3Config | null;
    // Credential management
    setCurrentS3Config: (s3Config: S3Config) => void;
    clearCurrentS3Config: () => void;
  };
};

// Create the store
export function createS3Slice<
  PC extends BaseProjectConfig & S3Config,
>(): StateCreator<S3State> {
  return createSlice<PC, S3State>((set, get, store) => ({
    // Initial state
    s3: {
      currentS3Config: null,

      // Actions
      setCurrentS3Config: (s3Config) => {
        set((state) =>
          produce(state, (draft) => {
            draft.s3.currentS3Config = s3Config;
          }),
        );
      },
      clearCurrentS3Config: () => {
        set((state) =>
          produce(state, (draft) => {
            draft.s3.currentS3Config = null;
          }),
        );
      },
    },
  }));
}
