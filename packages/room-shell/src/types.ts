import {ProgressInfo} from '@sqlrooms/utils';

export type RoomFileState =
  | {
      status: 'download' | 'upload' | 'done';
      progress?: ProgressInfo;
    }
  | {
      status: 'error';
      message?: string;
    };

export type RoomFileInfo = {
  pathname: string;
  duckdbFileName?: string;
  file?: File;
  size?: number;
  numRows?: number;
  // hasBeenUploaded?: boolean;
  // uploadState?: FileUploadState;
};

export enum DataSourceStatus {
  PENDING = 'PENDING',
  FETCHING = 'FETCHING',
  READY = 'READY',
  ERROR = 'ERROR',
}

export type DataSourceState = {
  status: DataSourceStatus;
  message?: string;
};
