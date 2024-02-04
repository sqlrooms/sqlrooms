import {ViewConfig} from '@sqlrooms/project-config';
import {ProgressInfo} from '@sqlrooms/utils';

export type SuggestedFix = {
  description: string | JSX.Element;
  queries: {
    tableName: string;
    query: string;
  }[];
  updateViewConfig?: {
    viewId: string;
    // <T extends ViewConfig>(config: T) => T;
    update: (config: ViewConfig) => ViewConfig;
  };
};

export type ColumnMappingValidationResult = {
  status: 'error' | 'info';
  message: string;
  column?: string;
  invalidRows?: {
    query: string;
    column?: string;
  };
  suggestedFix?: SuggestedFix;
};

export type ColumnMappingValidationResults = {
  // TODO: support multiple validation results per table?
  [table: string]: ColumnMappingValidationResult | undefined;
};

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

export const VALID_TIME_CLAUSE = `BETWEEN '1100-01-01' AND '2200-01-01'`;
export const VALID_NUMERIC_TIME_CLAUSE = `BETWEEN '1980-01-01' AND '2200-01-01'`;

export const LOCATIONS_COLUMN_SPECS: ColumnSpec[] = [
  {
    name: 'id',
    type: 'string',
    required: true,
    comment: 'Unique ID of the location',
  },
  {name: 'name', type: 'string', comment: 'Descriptive name of the location'},
  {
    name: 'lat',
    type: 'number',
    required: true,
    nameVariants: ['lat', 'latitude', 'y'],
    comment: 'Latitude of the location',
  },
  {
    name: 'lon',
    type: 'number',
    required: true,
    nameVariants: ['lon', 'lng', 'longitude', 'x'],
    comment: 'Longitude of the location',
  },
];
export const FLOWS_COLUMN_SPECS: ColumnSpec[] = [
  {
    name: 'origin',
    type: 'string',
    required: true,
    nameVariants: ['origin', 'from', 'source'],
    comment: `The origin location ID`,
  },
  {
    name: 'dest',
    type: 'string',
    required: true,
    nameVariants: ['dest', 'to', 'target'],
    comment: `The destination location ID`,
  },
  {
    name: 'count',
    type: 'number',
    comment: `The number of trips between the origin and the destination. 
       When omitted each row counts as 1 trip.`,
    nameVariants: ['amount', 'volume', 'number'],
  },
  {
    name: 'time',
    type: 'datetime',
    comment: `The time when the trips were taking place`,
    nameVariants: ['date', 'tstamp', 'timestamp'],
  },
];
