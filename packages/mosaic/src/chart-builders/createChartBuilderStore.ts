import {produce} from 'immer';
import {createStore} from 'zustand/vanilla';

export type ChartBuilderStoreState = {
  selectedTemplateId?: string;
  fieldValues: Record<string, string>;
  reset: () => void;
  selectTemplate: (templateId: string) => void;
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
