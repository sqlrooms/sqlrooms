import {
  createContext,
  useContext,
  type ComponentProps,
  type PropsWithChildren,
  type ReactElement,
} from 'react';
import {Table} from '@sqlrooms/ui';
import {getProfilerTableWidth} from './layout';
import {
  MosaicProfilerHeader,
  type MosaicProfilerHeaderProps,
} from './MosaicProfilerHeader';
import {
  MosaicProfilerRows,
  type MosaicProfilerRowsProps,
} from './MosaicProfilerRows';
import {
  MosaicProfilerStatusBar,
  type MosaicProfilerStatusBarProps,
} from './MosaicProfilerStatusBar';
import type {MosaicProfilerOptions, UseMosaicProfilerReturn} from './types';
import {useMosaicProfiler} from './useMosaicProfiler';

const profilerContext = createContext<UseMosaicProfilerReturn | null>(null);

function useProfilerCompoundContext() {
  const profiler = useContext(profilerContext);

  if (!profiler) {
    throw new Error(
      'MosaicProfiler compound components must be rendered inside <MosaicProfiler> or <MosaicProfiler.Root>.',
    );
  }

  return profiler;
}

export type MosaicProfilerRootProps = PropsWithChildren<{
  profiler: UseMosaicProfilerReturn;
}>;

/**
 * Provides an existing profiler instance to compound profiler subcomponents.
 */
export function MosaicProfilerRoot({
  children,
  profiler,
}: MosaicProfilerRootProps) {
  return (
    <profilerContext.Provider value={profiler}>
      {children}
    </profilerContext.Provider>
  );
}

export type MosaicProfilerProps = PropsWithChildren<MosaicProfilerOptions>;

/**
 * Creates a profiler instance and exposes it to compound profiler
 * subcomponents through context.
 */
function MosaicProfilerComponent({
  children,
  ...options
}: MosaicProfilerProps): ReactElement {
  const profiler = useMosaicProfiler(options);
  return (
    <MosaicProfilerRoot profiler={profiler}>{children}</MosaicProfilerRoot>
  );
}

export type MosaicProfilerCompoundHeaderProps = Omit<
  MosaicProfilerHeaderProps,
  'profiler'
>;

function MosaicProfilerCompoundHeader(
  props: MosaicProfilerCompoundHeaderProps,
) {
  const profiler = useProfilerCompoundContext();
  return <MosaicProfilerHeader {...props} profiler={profiler} />;
}

export type MosaicProfilerCompoundRowsProps = Omit<
  MosaicProfilerRowsProps,
  'profiler'
>;

function MosaicProfilerCompoundRows(props: MosaicProfilerCompoundRowsProps) {
  const profiler = useProfilerCompoundContext();
  return <MosaicProfilerRows {...props} profiler={profiler} />;
}

export type MosaicProfilerCompoundStatusBarProps = Omit<
  MosaicProfilerStatusBarProps,
  'profiler'
>;

function MosaicProfilerCompoundStatusBar(
  props: MosaicProfilerCompoundStatusBarProps,
) {
  const profiler = useProfilerCompoundContext();
  return <MosaicProfilerStatusBar {...props} profiler={profiler} />;
}

export type MosaicProfilerCompoundTableProps = ComponentProps<typeof Table>;

function MosaicProfilerCompoundTable({
  className,
  disableWrapper = true,
  style,
  ...props
}: MosaicProfilerCompoundTableProps) {
  const profiler = useProfilerCompoundContext();
  const tableWidth = getProfilerTableWidth(profiler.columns);

  return (
    <Table
      disableWrapper={disableWrapper}
      className={['min-w-full table-fixed', className]
        .filter(Boolean)
        .join(' ')}
      style={{width: `${tableWidth}px`, ...style}}
      {...props}
    />
  );
}

type MosaicProfilerCompoundComponent = ((
  props: MosaicProfilerProps,
) => ReactElement) & {
  Header: typeof MosaicProfilerCompoundHeader;
  Root: typeof MosaicProfilerRoot;
  Rows: typeof MosaicProfilerCompoundRows;
  StatusBar: typeof MosaicProfilerCompoundStatusBar;
  Table: typeof MosaicProfilerCompoundTable;
};

export const MosaicProfiler: MosaicProfilerCompoundComponent = Object.assign(
  MosaicProfilerComponent,
  {
    Header: MosaicProfilerCompoundHeader,
    Root: MosaicProfilerRoot,
    Rows: MosaicProfilerCompoundRows,
    StatusBar: MosaicProfilerCompoundStatusBar,
    Table: MosaicProfilerCompoundTable,
  },
);
