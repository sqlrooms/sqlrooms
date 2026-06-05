import {
  createContext,
  useContext,
  useEffect,
  type FC,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import {cn} from '@sqlrooms/ui';
import {QueryEditorPanelActions} from './components/QueryEditorPanelActions';
import {QueryEditorPanelEditor} from './components/QueryEditorPanelEditor';
import {
  QueryResultPanel,
  type QueryResultPanelProps,
} from './components/QueryResultPanel';
import {useStoreWithSqlEditor} from './SqlEditorSlice';

type SqlQueryContextValue = {
  queryId: string;
  readOnly?: boolean;
};

const SqlQueryContext = createContext<SqlQueryContextValue | null>(null);

function useSqlQueryContext() {
  const context = useContext(SqlQueryContext);
  if (!context) {
    throw new Error(
      'SqlQuery compound components must be used within SqlQuery.Root',
    );
  }
  return context;
}

export type SqlQueryRootProps = PropsWithChildren<{
  queryId: string;
  name?: string;
  initialQuery?: string;
  readOnly?: boolean;
  className?: string;
}>;

const SqlQueryRoot: FC<SqlQueryRootProps> = ({
  queryId,
  name,
  initialQuery,
  readOnly,
  className,
  children,
}) => {
  const ensureQuery = useStoreWithSqlEditor(
    (state) => state.sqlEditor.ensureQuery,
  );

  useEffect(() => {
    ensureQuery(queryId, {name, query: initialQuery});
  }, [ensureQuery, initialQuery, name, queryId]);

  return (
    <SqlQueryContext.Provider value={{queryId, readOnly}}>
      <div className={cn('flex h-full min-h-0 flex-col', className)}>
        {children}
      </div>
    </SqlQueryContext.Provider>
  );
};

export type SqlQueryHeaderProps = PropsWithChildren<{
  title?: ReactNode;
  className?: string;
}>;

const SqlQueryHeader: FC<SqlQueryHeaderProps> = ({
  title,
  className,
  children,
}) => {
  if (!title && !children) return null;

  return (
    <div
      className={cn(
        'border-border flex items-center gap-2 border-b px-3 py-2',
        className,
      )}
    >
      {title ? (
        <div className="min-w-0 flex-1 truncate text-sm font-medium">
          {title}
        </div>
      ) : null}
      {children}
    </div>
  );
};

export type SqlQueryToolbarProps = PropsWithChildren<{
  className?: string;
}>;

const SqlQueryToolbar: FC<SqlQueryToolbarProps> = ({className, children}) => (
  <div className={cn('flex items-center gap-2 px-3 py-2', className)}>
    {children}
  </div>
);

export type SqlQueryActionsProps = {
  className?: string;
};

const SqlQueryActions: FC<SqlQueryActionsProps> = ({className}) => {
  const {queryId, readOnly} = useSqlQueryContext();
  if (readOnly) return null;
  return <QueryEditorPanelActions queryId={queryId} className={className} />;
};

export type SqlQueryEditorProps = {
  className?: string;
  autoHeight?: boolean;
  compact?: boolean;
};

const SqlQueryEditor: FC<SqlQueryEditorProps> = ({
  className,
  autoHeight,
  compact,
}) => {
  const {queryId, readOnly} = useSqlQueryContext();
  return (
    <QueryEditorPanelEditor
      queryId={queryId}
      readOnly={readOnly}
      className={className}
      autoHeight={autoHeight}
      compact={compact}
    />
  );
};

export type SqlQueryResultsProps = Omit<QueryResultPanelProps, 'queryId'>;

const SqlQueryResults: FC<SqlQueryResultsProps> = (props) => {
  const {queryId} = useSqlQueryContext();
  return <QueryResultPanel {...props} queryId={queryId} />;
};

export const SqlQuery = Object.assign(SqlQueryRoot, {
  Root: SqlQueryRoot,
  Header: SqlQueryHeader,
  Toolbar: SqlQueryToolbar,
  Actions: SqlQueryActions,
  Editor: SqlQueryEditor,
  Results: SqlQueryResults,
});
