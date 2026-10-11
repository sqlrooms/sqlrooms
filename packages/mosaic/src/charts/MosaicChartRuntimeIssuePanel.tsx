import type {FC} from 'react';
import type {ChartRuntimeIssue} from '../chart-runtime';

export type MosaicChartRuntimeIssuePanelProps = {
  issue: ChartRuntimeIssue;
};

export const MosaicChartRuntimeIssuePanel: FC<
  MosaicChartRuntimeIssuePanelProps
> = ({issue}) => {
  const title =
    issue.kind === 'too-much-data'
      ? 'Too much data'
      : issue.kind === 'sql-error'
        ? 'Chart query failed'
        : 'Unable to display chart';

  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center p-4">
      <div className="mb-2 text-center font-semibold">{title}</div>
      <div className="text-center text-sm whitespace-pre-wrap">
        {issue.message}
      </div>
    </div>
  );
};
