import {produce} from 'immer';
import {createStore} from 'zustand/vanilla';
import {VgPlotChartType} from '../chart-types';

export type ChartBuilderStoreState = {
  selectedTemplateId?: VgPlotChartType;
  fieldValues: Record<string, string>;
  reset: () => void;
  selectTemplate: (templateId: VgPlotChartType) => void;
  setFieldValue: (fieldKey: string, value: string) => void;
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
