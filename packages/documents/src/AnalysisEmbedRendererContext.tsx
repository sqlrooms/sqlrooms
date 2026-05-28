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

export type AnalysisArtifactEmbedType = {
  artifactType: string;
  label?: string;
  description?: string;
  createNode?: (blockId: string) => Record<string, unknown>;
};

type AnalysisEmbedRendererContextValue = {
  renderers: AnalysisArtifactEmbedRenderers;
  artifactTypes: AnalysisArtifactEmbedType[];
};

const AnalysisEmbedRendererContext =
  createContext<AnalysisEmbedRendererContextValue>({
    renderers: {},
    artifactTypes: [],
  });

export type AnalysisEmbedRendererProviderProps = PropsWithChildren<{
  renderers?: AnalysisArtifactEmbedRenderers;
  artifactTypes?: AnalysisArtifactEmbedType[];
}>;

export const AnalysisEmbedRendererProvider: FC<
  AnalysisEmbedRendererProviderProps
> = ({renderers = {}, artifactTypes, children}) => {
  const supportedArtifactTypes =
    artifactTypes ??
    Object.keys(renderers).map((artifactType) => ({
      artifactType,
    }));

  return (
    <AnalysisEmbedRendererContext.Provider
      value={{renderers, artifactTypes: supportedArtifactTypes}}
    >
      {children}
    </AnalysisEmbedRendererContext.Provider>
  );
};

export function useAnalysisArtifactEmbedRenderer(artifactType: string) {
  return useContext(AnalysisEmbedRendererContext).renderers[artifactType];
}

export function useAnalysisArtifactEmbedTypes() {
  return useContext(AnalysisEmbedRendererContext).artifactTypes;
}
