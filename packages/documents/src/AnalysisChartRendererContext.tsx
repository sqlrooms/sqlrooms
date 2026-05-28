import {
  createContext,
  useContext,
  type FC,
  type PropsWithChildren,
} from 'react';

export type AnalysisChartRendererProps = {
  analysisId: string;
  blockId: string;
  tableName: string;
  config: unknown;
  selectionGroupId?: string;
  caption?: string;
  readOnly?: boolean;
  onConfigChange?: (config: unknown) => void;
  onCaptionChange?: (caption: string | undefined) => void;
};

export type AnalysisChartRenderer = FC<AnalysisChartRendererProps>;

type AnalysisChartRendererContextValue = {
  renderer?: AnalysisChartRenderer;
};

const AnalysisChartRendererContext =
  createContext<AnalysisChartRendererContextValue>({});

export type AnalysisChartRendererProviderProps = PropsWithChildren<{
  renderer?: AnalysisChartRenderer;
}>;

export const AnalysisChartRendererProvider: FC<
  AnalysisChartRendererProviderProps
> = ({renderer, children}) => {
  return (
    <AnalysisChartRendererContext.Provider value={{renderer}}>
      {children}
    </AnalysisChartRendererContext.Provider>
  );
};

export function useAnalysisChartRenderer() {
  return useContext(AnalysisChartRendererContext).renderer;
}
