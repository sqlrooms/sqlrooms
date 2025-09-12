import {
  NotebookCellTypes,
  NotebookSliceConfig,
  NotebookTab,
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
