import {produce} from 'immer';
import {createStore} from 'zustand/vanilla';
import {ChartType} from '../chart-types';

export type ChartBuilderStoreState = {
  selectedTemplateId?: ChartType;
  fieldValues: Record<string, unknown>;
  reset: () => void;
  selectTemplate: (templateId: ChartType) => void;
  setFieldValue: (fieldKey: string, value: unknown) => void;
};

export type ChartBuilderStore = ReturnType<typeof createChartBuilderStore>;

export function createChartBuilderStore() {
  return createStore<ChartBuilderStoreState>((set) => ({
    selectedTemplateId: undefined,
    fieldValues: {},
    reset: () => {
      set((state) =>
        produce(state, (draft) => {
          draft.selectedTemplateId = undefined;
          draft.fieldValues = {};
        }),
      );
    },
    selectTemplate: (templateId) => {
      set((state) =>
        produce(state, (draft) => {
          draft.selectedTemplateId = templateId;
          draft.fieldValues = {};
        }),
      );
    },
    setFieldValue: (fieldKey, value) => {
      set((state) =>
        produce(state, (draft) => {
          draft.fieldValues[fieldKey] = value;
        }),
      );
    },
  }));
}
