import {useState, useEffect} from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import {
  InputTypes,
  NotebookCellTypes,
  NotebookSliceConfig,
  NotebookTab,
  InputUnion,
} from './cellSchemas';

export const findTab = (
  notebook: NotebookSliceConfig['notebook'],
  tabId: string,
): NotebookTab => {
  const tab = notebook.tabs.find((t) => t.id === tabId);
  if (!tab) {
    throw new Error(`Tab with id ${tabId} not found`);
  }
  return tab;
};

export const getCellTypeLabel = (type: NotebookCellTypes) => {
  const typeToLabel: Record<NotebookCellTypes, string> = {
    sql: 'SQL',
    vega: 'Chart',
    text: 'Text',
    input: 'Input',
  };
  return typeToLabel[type];
};

export const initializeInput = (
  type: InputTypes,
  oldInput: InputUnion,
): InputUnion => {
  const name = oldInput.varName;
  switch (type) {
    case 'text':
      return {
        kind: 'text',
        varName: name,
        value: '',
      };
    case 'slider':
      return {
        kind: 'slider',
        varName: name,
        min: 0,
        max: 100,
        step: 1,
        value: 0,
      };
    case 'dropdown':
      return {
        kind: 'dropdown',
        varName: name,
        options: [],
        value: '',
      };
  }
};

dayjs.extend(relativeTime);

export function useRelativeTimeDisplay(pastDate: number | null): string {
  const [relativeTimeStr, setRelativeTimeStr] = useState('');

  useEffect(() => {
    if (!pastDate) {
      setRelativeTimeStr('');
      return;
    }

    const updateRelativeTime = () => {
      const now = dayjs();
      const past = dayjs(pastDate);

      const diffInDays = now.diff(past, 'day');

      if (diffInDays >= 7) {
        // Show full date for older than a week
        setRelativeTimeStr(past.format('YYYY-MM-DD'));
      } else {
        setRelativeTimeStr(past.fromNow());
      }
    };

    updateRelativeTime();
    const interval = setInterval(updateRelativeTime, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [pastDate]);

  return relativeTimeStr;
}
