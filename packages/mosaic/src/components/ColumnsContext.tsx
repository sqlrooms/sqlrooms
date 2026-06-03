import {
  createContext,
  useContext,
  useMemo,
  type FC,
  type PropsWithChildren,
} from 'react';
import type {TableColumn} from '@sqlrooms/duckdb';

export interface ColumnsContextValue {
  columns: TableColumn[];
}

const ColumnsContext = createContext<ColumnsContextValue | null>(null);

export function useColumnsContext(): ColumnsContextValue {
  const context = useContext(ColumnsContext);
  if (!context) {
    throw new Error('useColumnsContext must be used within a ColumnsProvider');
  }

  return context;
}

export interface ColumnsProviderProps extends PropsWithChildren {
  columns: TableColumn[];
}

export const ColumnsProvider: FC<ColumnsProviderProps> = ({
  columns,
  children,
}) => {
  const value = useMemo(() => ({columns}), [columns]);

  return (
    <ColumnsContext.Provider value={value}>{children}</ColumnsContext.Provider>
  );
};
