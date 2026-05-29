import {
  createContext,
  useContext,
  type FC,
  type PropsWithChildren,
} from 'react';

export type BlocksDocumentArtifactEmbedRendererProps = {
  parentArtifactId: string;
  blockId: string;
  artifactId: string;
  artifactType: string;
  caption?: string;
  readOnly?: boolean;
  onCaptionChange?: (caption: string | undefined) => void;
};

export type BlocksDocumentArtifactEmbedRenderer =
  FC<BlocksDocumentArtifactEmbedRendererProps>;

export type BlocksDocumentArtifactEmbedRenderers = Record<
  string,
  BlocksDocumentArtifactEmbedRenderer
>;

export type BlocksDocumentArtifactEmbedType = {
  artifactType: string;
  label?: string;
  description?: string;
  createNode?: (blockId: string) => Record<string, unknown>;
};

type BlocksDocumentEmbedRendererContextValue = {
  renderers: BlocksDocumentArtifactEmbedRenderers;
  artifactTypes: BlocksDocumentArtifactEmbedType[];
};

const BlocksDocumentEmbedRendererContext =
  createContext<BlocksDocumentEmbedRendererContextValue>({
    renderers: {},
    artifactTypes: [],
  });

export type BlocksDocumentEmbedRendererProviderProps = PropsWithChildren<{
  renderers?: BlocksDocumentArtifactEmbedRenderers;
  artifactTypes?: BlocksDocumentArtifactEmbedType[];
}>;

export const BlocksDocumentEmbedRendererProvider: FC<
  BlocksDocumentEmbedRendererProviderProps
> = ({renderers = {}, artifactTypes, children}) => {
  const supportedArtifactTypes =
    artifactTypes ??
    Object.keys(renderers).map((artifactType) => ({
      artifactType,
    }));

  return (
    <BlocksDocumentEmbedRendererContext.Provider
      value={{renderers, artifactTypes: supportedArtifactTypes}}
    >
      {children}
    </BlocksDocumentEmbedRendererContext.Provider>
  );
};

export function useBlocksDocumentArtifactEmbedRenderer(artifactType: string) {
  return useContext(BlocksDocumentEmbedRendererContext).renderers[artifactType];
}

export function useBlocksDocumentArtifactEmbedTypes() {
  return useContext(BlocksDocumentEmbedRendererContext).artifactTypes;
}
