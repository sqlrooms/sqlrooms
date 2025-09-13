import React from 'react';
import {Loader2} from 'lucide-react';

type ToolCallingProps = {
  toolName: string;
};

export const ToolCalling: React.FC<ToolCallingProps> = ({toolName}) => {
  return (
    <div className="flex items-center gap-2 bg-amber-300 text-sm text-gray-500">
      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      <span>{`calling tool ${toolName}`}</span>
    </div>
  );
};
