import Markdown from 'react-markdown';
import {Components} from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {MessageContainer} from './MessageContainer';

export type ErrorMessageComponentProps = {
  errorMessage: string;
  components?: Partial<Components>;
};

export function ErrorMessage(props: ErrorMessageComponentProps) {
  return (
    <MessageContainer isSuccess={false} type="error" content={props}>
      <div className="prose dark:prose-invert max-w-none text-sm">
        <Markdown remarkPlugins={[remarkGfm]} components={props.components}>
          {props.errorMessage}
        </Markdown>
      </div>
    </MessageContainer>
  );
}
