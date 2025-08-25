import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {MessageContainer} from './MessageContainer';

export function ErrorMessage(props: {errorMessage: string}) {
  return (
    <MessageContainer isSuccess={false} type="error" content={props}>
      <Markdown
        className="prose dark:prose-invert max-w-none text-sm"
        remarkPlugins={[remarkGfm]}
      >
        {props.errorMessage}
      </Markdown>
    </MessageContainer>
  );
}
