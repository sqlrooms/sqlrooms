import {useMemo} from 'react';
import type {ChartRuntimeIssue} from '../chart-runtime';
import {useStoreWithMosaicDashboard} from '../dashboard/MosaicDashboardSlice';

export type RuntimeIssueReporter = {
  reportIssue: (issueToReport: ChartRuntimeIssue) => void;
  clearIssue: () => void;
};

export function useRuntimeIssueReporter(
  runtimeIssueKey: string | undefined,
): RuntimeIssueReporter {
  const reportPanelIssueByKey = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.reportPanelIssueByKey,
  );
  const clearPanelIssueByKey = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.clearPanelIssueByKey,
  );

  return useMemo(
    () => ({
      reportIssue: (issueToReport: ChartRuntimeIssue) => {
        if (runtimeIssueKey) {
          reportPanelIssueByKey(runtimeIssueKey, issueToReport);
        }
      },
      clearIssue: () => {
        if (runtimeIssueKey) {
          clearPanelIssueByKey(runtimeIssueKey);
        }
      },
    }),
    [clearPanelIssueByKey, reportPanelIssueByKey, runtimeIssueKey],
  );
}
