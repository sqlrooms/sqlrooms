import Markdown from 'react-markdown';
import {MessageContainer} from './MessageContainer';

export function ErrorMessage(props: {errorMessage: string}) {
  return (
    <MessageContainer isSuccess={false} type="error" content={props}>
      <Markdown className="prose dark:prose-invert max-w-none text-sm">
        {props.errorMessage}
      </Markdown>
    </MessageContainer>
  );
}
