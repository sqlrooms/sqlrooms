import {cn} from '@sqlrooms/ui';
import Markdown from 'react-markdown';
import {Components} from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {MessageContainer} from './MessageContainer';

export type ErrorMessageComponentProps = {
  errorMessage: string;
  components?: Partial<Components>;
};

const markdownTableComponent: Components['table'] = ({
  className,
  node: _node,
  ...props
}) => (
  <div className="max-w-full overflow-x-auto">
    <table className={cn('w-max min-w-full', className)} {...props} />
  </div>
);

export function ErrorMessage(props: ErrorMessageComponentProps) {
  const components = {
    table: markdownTableComponent,
    ...props.components,
  } as Partial<Components>;

  return (
    <MessageContainer isSuccess={false} type="error" content={props}>
      <div className="text-foreground prose dark:prose-invert max-w-none min-w-0 overflow-hidden text-sm [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:wrap-break-word [&_pre]:whitespace-pre-wrap [&_pre_code]:wrap-break-word [&_pre_code]:whitespace-pre-wrap">
        <Markdown remarkPlugins={[remarkGfm]} components={components}>
          {props.errorMessage}
        </Markdown>
      </div>
    </MessageContainer>
  );
}
