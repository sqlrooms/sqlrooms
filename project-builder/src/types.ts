import {ProgressInfo} from '@sqlrooms/utils';

export type ProjectFileState =
  | {
      status: 'download' | 'upload' | 'done';
      progress?: ProgressInfo;
    }
  | {
      status: 'error';
      message?: string;
    };

export type ProjectFileInfo = {
  pathname: string;
  duckdbFileName?: string;
  file?: File;
  size?: number;
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

export type ColumnSpec = {
  name: string;
  type: 'string' | 'number' | 'datetime';
  comment?: string;
  required?: boolean;
  nameVariants?: string[];
};
