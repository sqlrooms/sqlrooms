import {FC} from 'react';

export const UpdateFileContentToolResult: FC<{
  success: true;
  details: {
    path: string;
    content: string;
  };
}> = ({details}) => {
  return (
    <div className="text-foreground/50 text-xs">
      Modifying file <span className="font-mono">{details.path}</span>
    </div>
  );
};
