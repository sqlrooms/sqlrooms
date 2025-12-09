import {useEffect, useMemo, useState} from 'react';
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
  notebook: NotebookSliceConfig,
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

const computeRelativeTime = (timestamp: number | null) => {
  if (!timestamp) return '';

  const now = dayjs();
  const past = dayjs(timestamp);
  const diffInDays = now.diff(past, 'day');

  return diffInDays >= 7 ? past.format('YYYY-MM-DD') : past.fromNow();
};

export function useRelativeTimeDisplay(pastDate: number | null): string {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!pastDate) return;
    const interval = setInterval(() => setTick((value) => value + 1), 60000);
    return () => clearInterval(interval);
  }, [pastDate]);

  return useMemo(() => computeRelativeTime(pastDate), [pastDate, tick]);
}
