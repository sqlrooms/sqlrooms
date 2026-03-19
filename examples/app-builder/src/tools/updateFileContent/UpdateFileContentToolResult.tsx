import type {ToolRendererProps} from '@sqlrooms/ai-core';
import {FC} from 'react';
import type {UpdateFileContentToolOutput} from './updateFileContentTool';

export const UpdateFileContentToolResult: FC<
  ToolRendererProps<UpdateFileContentToolOutput>
> = ({output}) => {
  return (
    <div className="text-foreground/50 text-xs">
      Modifying file <span className="font-mono">{output?.details?.path}</span>
    </div>
  );
};
