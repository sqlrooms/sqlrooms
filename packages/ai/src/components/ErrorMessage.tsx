import Markdown from 'react-markdown';
import {MessageContainer} from './MessageContainer';

export function ErrorMessage(props: {errorMessage: string}) {
  return (
    <div className="flex flex-col gap-5 px-4">
      <MessageContainer
        isSuccess={false}
        borderColor={'border-red-500'}
        title={'error'}
        content={props}
      >
        <Markdown className="text-xs prose dark:prose-invert max-w-none">
          {props.errorMessage}
        </Markdown>
      </MessageContainer>
    </div>
  );
}
