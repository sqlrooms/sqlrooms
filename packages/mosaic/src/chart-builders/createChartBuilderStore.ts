import {produce} from 'immer';
import {createStore} from 'zustand/vanilla';
import {ChartConfig, ChartType} from '../charts/chart-types';

export type ChartBuilderStoreState = {
  selectedTemplateId?: ChartType;
  fieldValues: Record<string, unknown>;
  /** Chart-local options outside active settings, preserved through creation. */
  chartOptions: Partial<ChartConfig>;
  reset: () => void;
  selectTemplate: (templateId: ChartType) => void;
  setFieldValue: (fieldKey: string, value: unknown) => void;
  /** Replace a draft without discarding chart-specific options. */
  setConfig: (config: ChartConfig) => void;
};

export type ChartBuilderStore = ReturnType<typeof createChartBuilderStore>;

export function createChartBuilderStore() {
  return createStore<ChartBuilderStoreState>((set) => ({
    selectedTemplateId: undefined,
    fieldValues: {},
    chartOptions: {},
    reset: () => {
      set((state) =>
        produce(state, (draft) => {
          draft.selectedTemplateId = undefined;
          draft.fieldValues = {};
          draft.chartOptions = {};
        }),
      );
    },
    selectTemplate: (templateId) => {
      set((state) =>
        produce(state, (draft) => {
          draft.selectedTemplateId = templateId;
          draft.fieldValues = {};
          draft.chartOptions = {};
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
    setConfig: ({chartType, settings, ...chartOptions}) => {
      set({selectedTemplateId: chartType, fieldValues: settings, chartOptions});
    },
  }));
}
