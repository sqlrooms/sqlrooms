import type {
  StatefulBlockDefinition,
  StatefulBlockRenderProps,
} from '@sqlrooms/blocks';
import type {BaseRoomStoreState} from '@sqlrooms/room-shell';
import {cn} from '@sqlrooms/ui';
import {Code2Icon} from 'lucide-react';
import type {ComponentType, FC} from 'react';
import {SqlQuery} from './SqlQuery';
import type {SqlEditorSliceState} from './SqlEditorSlice';

export type SqlQueryBlockProps = Partial<StatefulBlockRenderProps> & {
  queryId?: string;
  className?: string;
  editorClassName?: string;
  resultsClassName?: string;
};

export const SQL_QUERY_BLOCK_TYPE = 'sql-query';

export const SqlQueryBlock: FC<SqlQueryBlockProps> = ({
  blockId,
  queryId,
  title,
  readOnly,
  className,
  editorClassName,
  resultsClassName,
}) => {
  const resolvedQueryId = queryId ?? blockId;

  if (!resolvedQueryId) {
    return (
      <div className="text-muted-foreground p-4 text-sm">
        SQL query block is missing a query id.
      </div>
    );
  }

  return (
    <SqlQuery.Root
      queryId={resolvedQueryId}
      name={title ?? 'SQL Query'}
      readOnly={readOnly}
      className={cn('bg-background h-full min-h-[420px]', className)}
    >
      <SqlQuery.Header title={title ?? 'SQL Query'}>
        <SqlQuery.Actions />
      </SqlQuery.Header>
      <div className="min-h-[220px] flex-1">
        <SqlQuery.Editor className={cn('min-h-[220px]', editorClassName)} />
      </div>
      <div
        className={cn(
          'border-border min-h-[220px] border-t',
          resultsClassName,
        )}
      >
        <SqlQuery.Results />
      </div>
    </SqlQuery.Root>
  );
};

export type CreateSqlQueryBlockDefinitionOptions<
  TRoomState extends BaseRoomStoreState & SqlEditorSliceState,
> = {
  label?: string;
  defaultTitle?: string;
  render?: ComponentType<StatefulBlockRenderProps<TRoomState>>;
};

export function createSqlQueryBlockDefinition<
  TRoomState extends BaseRoomStoreState & SqlEditorSliceState,
>({
  label = 'SQL Query',
  defaultTitle = 'SQL Query',
  render = SqlQueryBlock as ComponentType<StatefulBlockRenderProps<TRoomState>>,
}: CreateSqlQueryBlockDefinitionOptions<
  TRoomState
> = {}): StatefulBlockDefinition<TRoomState> {
  return {
    type: SQL_QUERY_BLOCK_TYPE,
    label,
    defaultTitle,
    icon: Code2Icon,
    capabilities: {
      stateful: true,
      executable: true,
    },
    ensureState: ({blockId, title, getState}) => {
      getState().sqlEditor.ensureQuery(blockId, {
        name: title ?? defaultTitle,
      });
    },
    deleteState: ({blockId, getState}) => {
      getState().sqlEditor.removeQuery(blockId);
    },
    rename: ({blockId, title, getState}) => {
      getState().sqlEditor.renameQuery(blockId, title);
    },
    render,
  };
}
