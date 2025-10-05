import {FC} from 'react';

export const GetFileContentToolResult: FC<{
  success: true;
  details: {
    path: string;
    content: string;
  };
}> = ({details}) => {
  return (
    <div className="text-foreground/50 p-2 text-xs">
      Getting the content of <span className="font-mono">{details.path}</span>
      ...
    </div>
  );
};
