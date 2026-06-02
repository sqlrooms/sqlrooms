import {
  BlockDocumentChartRendererProvider,
  BlockDocumentEditor,
  BlockDocumentStatefulBlockRendererProvider,
  createEmptyBlockDocumentContent,
  type BlockDocumentChartRenderer,
  type BlockDocumentContent,
  type BlockDocumentStatefulBlockRenderer,
  type BlockDocumentStatefulBlockRendererProps,
  type BlockDocumentStatefulBlockType,
} from '@sqlrooms/documents';
import {useMutation} from '@tanstack/react-query';
import {BarChart3, Database, LayoutDashboard, Table2} from 'lucide-react';
import type React from 'react';
import {useEffect, useMemo, useState} from 'react';
import type {JsonObject} from '#/lib/json';

type WorksheetSurfaceProps = {
  worksheet: {
    id: string;
    title: string;
    content: JsonObject;
  };
  token: string | null;
  workspaceId: string | null;
};

export function WorksheetSurface({
  worksheet,
  token,
  workspaceId,
}: WorksheetSurfaceProps) {
  const [title, setTitle] = useState(worksheet.title);
  const [content, setContent] = useState<BlockDocumentContent>(() =>
    toBlockDocumentContent(worksheet.content),
  );

  useEffect(() => {
    setTitle(worksheet.title);
    setContent(toBlockDocumentContent(worksheet.content));
  }, [worksheet.content, worksheet.id, worksheet.title]);

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      data: {
        token: string;
        workspaceId: string;
        worksheetId: string;
        title: string;
        content: JsonObject;
      };
    }) => {
      const {saveWorksheetContent} = await import('./workspace/worksheets');
      return saveWorksheetContent(payload);
    },
  });

  useEffect(() => {
    if (!token || !workspaceId) return;
    const timeout = window.setTimeout(() => {
      void saveMutation.mutateAsync({
        data: {
          token,
          workspaceId,
          worksheetId: worksheet.id,
          title,
          content: content as unknown as JsonObject,
        },
      });
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [content, saveMutation, title, token, workspaceId, worksheet.id]);

  const blockTypes = useMemo(() => createWorksheetBlockTypes(), []);

  return (
    <div className="worksheet-document-surface">
      <BlockDocumentChartRendererProvider renderer={WorksheetChartBlock}>
        <BlockDocumentStatefulBlockRendererProvider
          blockTypes={blockTypes}
          renderers={WORKSHEET_BLOCK_RENDERERS}
        >
          <BlockDocumentEditor
            documentId={worksheet.id}
            value={content}
            title={title}
            onChange={setContent}
            onTitleChange={setTitle}
          >
            <BlockDocumentEditor.Content />
          </BlockDocumentEditor>
        </BlockDocumentStatefulBlockRendererProvider>
      </BlockDocumentChartRendererProvider>
    </div>
  );
}

const WORKSHEET_BLOCK_RENDERERS = {
  query: QueryBlock,
  dashboard: DashboardBlock,
  'data-table': DataTableBlock,
  chart: ChartStatefulBlock,
} satisfies Record<string, BlockDocumentStatefulBlockRenderer>;

function createWorksheetBlockTypes(): BlockDocumentStatefulBlockType[] {
  return [
    createWorksheetBlockType({
      blockType: 'query',
      label: 'Query',
      title: 'Query',
      defaultHeight: 320,
    }),
    createWorksheetBlockType({
      blockType: 'dashboard',
      label: 'Dashboard',
      title: 'Dashboard',
      defaultHeight: 520,
    }),
    createWorksheetBlockType({
      blockType: 'data-table',
      label: 'Data Table',
      title: 'Data Table',
      defaultHeight: 420,
    }),
    createWorksheetBlockType({
      blockType: 'chart',
      label: 'Chart',
      title: 'Chart',
      defaultHeight: 420,
    }),
  ];
}

function createWorksheetBlockType({
  blockType,
  label,
  title,
  defaultHeight,
}: {
  blockType: string;
  label: string;
  title: string;
  defaultHeight: number;
}): BlockDocumentStatefulBlockType {
  return {
    blockType,
    label,
    resizableHeight: true,
    defaultHeight,
    minHeight: 220,
    maxHeight: 1200,
    createNode: (blockId, options) => ({
      type: 'blockDocumentStatefulBlock',
      attrs: {
        id: blockId,
        blockType,
        blockInstanceId: blockId,
        ownership: 'owned',
        title,
        caption: options?.initialText ?? '',
        height: defaultHeight,
      },
    }),
  };
}

function QueryBlock(props: BlockDocumentStatefulBlockRendererProps) {
  return (
    <WorksheetBlockFrame icon={<Database className="size-4" />} title="Query">
      <textarea
        className="worksheet-block-textarea"
        value={props.caption ?? ''}
        onChange={(event) => props.onCaptionChange?.(event.target.value)}
        spellCheck={false}
      />
    </WorksheetBlockFrame>
  );
}

function DashboardBlock() {
  return (
    <WorksheetBlockFrame
      icon={<LayoutDashboard className="size-4" />}
      title="Dashboard"
    >
      <div className="worksheet-block-placeholder">No panels</div>
    </WorksheetBlockFrame>
  );
}

function DataTableBlock(props: BlockDocumentStatefulBlockRendererProps) {
  return (
    <WorksheetBlockFrame
      icon={<Table2 className="size-4" />}
      title="Data Table"
    >
      <input
        className="worksheet-block-input"
        value={props.caption ?? ''}
        onChange={(event) => props.onCaptionChange?.(event.target.value)}
      />
    </WorksheetBlockFrame>
  );
}

function ChartStatefulBlock(props: BlockDocumentStatefulBlockRendererProps) {
  return (
    <WorksheetBlockFrame icon={<BarChart3 className="size-4" />} title="Chart">
      <input
        className="worksheet-block-input"
        value={props.caption ?? ''}
        onChange={(event) => props.onCaptionChange?.(event.target.value)}
      />
    </WorksheetBlockFrame>
  );
}

const WorksheetChartBlock: BlockDocumentChartRenderer = () => {
  return (
    <WorksheetBlockFrame icon={<BarChart3 className="size-4" />} title="Chart">
      <div className="worksheet-block-placeholder">No chart</div>
    </WorksheetBlockFrame>
  );
};

function WorksheetBlockFrame({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="worksheet-block-frame">
      <div className="worksheet-block-header">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function toBlockDocumentContent(content: JsonObject): BlockDocumentContent {
  if (content.type === 'doc' && Array.isArray(content.content)) {
    return content as unknown as BlockDocumentContent;
  }
  return createEmptyBlockDocumentContent();
}
