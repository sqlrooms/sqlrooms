import {PropsWithChildren, type FC} from 'react';
import {
  ChartSpecError,
  InvalidColumnTypeError,
  MissingColumnsError,
  RequiredFieldsError,
} from './chart-types';

type MosaicChartErrorProps = {
  error: Error;
};

export const MosaicChartError: FC<MosaicChartErrorProps> = ({error}) => {
  if (error instanceof RequiredFieldsError) {
    return (
      <ErrorPanel title="Configure chart to display visualization">
        <span>Required fields are missing: </span>
        {error.fieldNames.map((fieldName, index) => (
          <span key={index}>
            <Pill>{fieldName}</Pill>{' '}
          </span>
        ))}
      </ErrorPanel>
    );
  }

  if (error instanceof MissingColumnsError) {
    return (
      <ErrorPanel title="The visualization can't be displayed">
        <span>Selected columns are missing in the dataset: </span>
        {error.columnNames.map((column, idx) => (
          <span key={idx}>
            <Pill>{column}</Pill>{' '}
          </span>
        ))}
      </ErrorPanel>
    );
  }

  if (error instanceof InvalidColumnTypeError) {
    return (
      <ErrorPanel title="The visualization can't be displayed">
        <p>
          <span>Selected columns have invalid type: </span>
          {error.columnNames.map((column, idx) => (
            <span key={idx}>
              <Pill>{column}</Pill>{' '}
            </span>
          ))}
        </p>
        <p>
          Expected type is <Pill>{error.expectedType}</Pill>.
        </p>
      </ErrorPanel>
    );
  }

  if (error instanceof ChartSpecError) {
    return (
      <ErrorPanel title="Configure chart to display visualization">
        {error.message}
      </ErrorPanel>
    );
  }

  return (
    <ErrorPanel title="Ooops! Something went wrong">{error.message}</ErrorPanel>
  );
};

type ErrorPanelProps = PropsWithChildren<{
  title: string;
}>;

const ErrorPanel: FC<ErrorPanelProps> = ({title, children}) => {
  return (
    <>
      <div className="text-center font-medium">{title}</div>
      <div className="text-center text-xs">{children}</div>
    </>
  );
};

const Pill: FC<PropsWithChildren> = ({children}) => {
  return (
    <span className="inline-flex items-center rounded-md border border-gray-600 bg-gray-800 px-1 py-0.5 text-xs font-medium text-gray-300">
      {children}
    </span>
  );
};
