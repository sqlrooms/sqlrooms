import {FC} from 'react';

const EchoToolResult: FC<{
  success: true;
  details: string;
}> = ({details}) => {
  return (
    <div className="border-muted text-fg rounded-md border-gray-200 bg-blue-500/50 p-2 text-sm">
      👋🏽 {details}
    </div>
  );
};

export default EchoToolResult;
