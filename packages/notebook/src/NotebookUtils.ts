import {
  ParameterTypes,
  NotebookCellTypes,
  NotebookSliceConfig,
  NotebookTab,
  ParameterUnion,
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

export const initializeParameter = (
  type: ParameterTypes,
  oldParameter: ParameterUnion,
): ParameterUnion => {
  const name = oldParameter.varName;
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
