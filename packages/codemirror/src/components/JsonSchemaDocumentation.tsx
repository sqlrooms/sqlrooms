import type {FC} from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface JsonSchemaDocumentationProps {
  documentation: string;
}

export const JsonSchemaDocumentation: FC<JsonSchemaDocumentationProps> = ({
  documentation,
}) => {
  if (!documentation || documentation.trim().length === 0) {
    return null;
  }

  return (
    <div className="prose dark:prose-invert bg-popover max-h-96 max-w-md overflow-y-auto p-2 text-sm">
      <Markdown remarkPlugins={[remarkGfm]}>{documentation}</Markdown>
    </div>
  );
};
