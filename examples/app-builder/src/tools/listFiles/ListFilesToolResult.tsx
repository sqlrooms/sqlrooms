import type {ToolRendererProps} from '@sqlrooms/ai-core';
import {FC} from 'react';
import type {ListFilesToolOutput} from './createListFilesTool';

export const ListFilesToolResult: FC<
  ToolRendererProps<ListFilesToolOutput>
> = () => {
  return (
    <div className="text-foreground/50 text-xs">Listing project files...</div>
  );
};
