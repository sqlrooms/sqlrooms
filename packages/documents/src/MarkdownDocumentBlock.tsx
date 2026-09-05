import type {
  StatefulBlockDefinition,
  StatefulBlockRenderProps,
} from '@sqlrooms/blocks';
import {ScrollTextIcon} from 'lucide-react';
import type {ComponentType} from 'react';
import {MarkdownDocument} from './MarkdownDocument';
import type {MarkdownDocumentsSliceState} from './MarkdownDocumentsSlice';

export type MarkdownDocumentBlockRenderProps<
  TRoomState extends MarkdownDocumentsSliceState = MarkdownDocumentsSliceState,
> = StatefulBlockRenderProps<TRoomState>;

export type CreateMarkdownDocumentBlockDefinitionOptions<
  TRoomState extends MarkdownDocumentsSliceState = MarkdownDocumentsSliceState,
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
  TRoomState extends MarkdownDocumentsSliceState = MarkdownDocumentsSliceState,
>({
  render = DefaultMarkdownDocumentBlock as ComponentType<
    MarkdownDocumentBlockRenderProps<TRoomState>
  >,
  label = 'Markdown',
  defaultTitle = 'Markdown',
  defaultMarkdown = '',
}: CreateMarkdownDocumentBlockDefinitionOptions<TRoomState> = {}): StatefulBlockDefinition<TRoomState> {
  return {
    type: 'markdown-document',
    label,
    defaultTitle,
    icon: ScrollTextIcon,
    capabilities: {
      stateful: true,
      embeddable: true,
    },
    render,
    ensureState: ({blockId, getState}) => {
      getState().markdownDocuments.ensureDocument(blockId, defaultMarkdown);
    },
    deleteState: ({blockId, getState}) => {
      getState().markdownDocuments.removeDocument(blockId);
    },
  };
}
