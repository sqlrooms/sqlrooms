import type {ToolRendererProps} from '@sqlrooms/ai-core';
import {FC} from 'react';

type EchoToolOutput = {
  success: boolean;
  details: string;
};

const EchoToolResult: FC<ToolRendererProps<EchoToolOutput>> = ({output}) => {
  return (
    <div className="border-muted text-fg rounded-md bg-blue-500/50 p-2 text-sm">
      👋🏽 {output?.details}
    </div>
  );
};

export default EchoToolResult;
