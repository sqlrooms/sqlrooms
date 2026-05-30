import type {
  StatefulBlockDefinition,
  StatefulBlockRenderProps,
} from '@sqlrooms/blocks';
import {ScrollTextIcon} from 'lucide-react';
import type {ComponentType} from 'react';
import {MarkdownDocument} from './MarkdownDocument';
import type {DocumentsSliceState} from './DocumentsSlice';

export type MarkdownDocumentBlockRenderProps<
  TRoomState extends DocumentsSliceState = DocumentsSliceState,
> = StatefulBlockRenderProps<TRoomState>;

export type CreateMarkdownDocumentBlockDefinitionOptions<
  TRoomState extends DocumentsSliceState = DocumentsSliceState,
> = {
  render?: ComponentType<MarkdownDocumentBlockRenderProps<TRoomState>>;
  label?: string;
  defaultTitle?: string;
  defaultMarkdown?: string;
};

const DefaultMarkdownDocumentBlock = ({
  blockId,
}: MarkdownDocumentBlockRenderProps) => {
  return <MarkdownDocument artifactId={blockId} />;
};

export function createMarkdownDocumentBlockDefinition<
  TRoomState extends DocumentsSliceState = DocumentsSliceState,
>({
  render = DefaultMarkdownDocumentBlock as ComponentType<
    MarkdownDocumentBlockRenderProps<TRoomState>
  >,
  label = 'Document',
  defaultTitle = 'Document',
  defaultMarkdown = '',
}: CreateMarkdownDocumentBlockDefinitionOptions<TRoomState> = {}): StatefulBlockDefinition<TRoomState> {
  return {
    type: 'document',
    label,
    defaultTitle,
    icon: ScrollTextIcon,
    capabilities: {
      stateful: true,
      embeddable: true,
    },
    render,
    ensureState: ({blockId, getState}) => {
      getState().documents.ensureDocument(blockId, defaultMarkdown);
    },
    deleteState: ({blockId, getState}) => {
      getState().documents.removeDocument(blockId);
    },
  };
}
