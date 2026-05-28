import {
  createContext,
  useContext,
  type FC,
  type PropsWithChildren,
} from 'react';

export type AnalysisArtifactEmbedRendererProps = {
  parentArtifactId: string;
  blockId: string;
  artifactId: string;
  artifactType: string;
  caption?: string;
  readOnly?: boolean;
  onCaptionChange?: (caption: string | undefined) => void;
};

export type AnalysisArtifactEmbedRenderer =
  FC<AnalysisArtifactEmbedRendererProps>;

export type AnalysisArtifactEmbedRenderers = Record<
  string,
  AnalysisArtifactEmbedRenderer
>;

type AnalysisEmbedRendererContextValue = {
  renderers: AnalysisArtifactEmbedRenderers;
};

const AnalysisEmbedRendererContext =
  createContext<AnalysisEmbedRendererContextValue>({renderers: {}});

export type AnalysisEmbedRendererProviderProps = PropsWithChildren<{
  renderers?: AnalysisArtifactEmbedRenderers;
}>;

export const AnalysisEmbedRendererProvider: FC<
  AnalysisEmbedRendererProviderProps
> = ({renderers = {}, children}) => {
  return (
    <AnalysisEmbedRendererContext.Provider value={{renderers}}>
      {children}
    </AnalysisEmbedRendererContext.Provider>
  );
};

export function useAnalysisArtifactEmbedRenderer(artifactType: string) {
  return useContext(AnalysisEmbedRendererContext).renderers[artifactType];
}
