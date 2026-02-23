import {cn} from '@sqlrooms/ui';
import type {FC, PropsWithChildren} from 'react';
import {BrowserView} from './BrowserView';
import {CodeView} from './CodeView';
import {TerminalView} from './TerminalView';
import {WebContainerWorkbench} from './WebContainerWorkbench';
import {FileTreeView} from './filetree/FileTreeView';

type WebContainerComponent = FC<PropsWithChildren<{className?: string}>> & {
  Container: FC<PropsWithChildren<{className?: string}>>;
  Workbench: typeof WebContainerWorkbench;
  FileTreeView: typeof FileTreeView;
  CodeView: typeof CodeView;
  TerminalView: typeof TerminalView;
  BrowserView: typeof BrowserView;
};

const ContainerBase: FC<PropsWithChildren<{className?: string}>> = ({
  className,
  children,
}) => <div className={cn('flex h-full w-full', className)}>{children}</div>;

export const WebContainer: WebContainerComponent = Object.assign(
  ContainerBase,
  {
    Container: ContainerBase,
    Workbench: WebContainerWorkbench,
    FileTreeView,
    CodeView,
    TerminalView,
    BrowserView,
  },
);
