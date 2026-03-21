import type {ToolRendererProps} from '@sqlrooms/ai-core';
import {FC} from 'react';
import type {GetFileContentToolOutput} from './getFileContentTool';

export const GetFileContentToolResult: FC<
  ToolRendererProps<GetFileContentToolOutput>
> = ({output}) => {
  return (
    <div className="text-foreground/50 text-xs">
      Getting the content of{' '}
      <span className="font-mono">{output?.details?.path}</span>
    </div>
  );
};
