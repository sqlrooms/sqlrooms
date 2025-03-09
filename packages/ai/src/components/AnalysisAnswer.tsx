import React from 'react';
import Markdown from 'react-markdown';
import {MessageContainer} from './MessageContainer';
import {getBorderColor} from './tools/ToolResult';

type AnalysisAnswerProps = {
  content: string;
  isAnswer: boolean;
};

/**
 * Renders an analysis answer with markdown content of the final streaming response.
 *
 * @param {AnalysisAnswerProps} props - The component props. See {@link AnalysisAnswerProps} for more details.
 * @returns {JSX.Element} The rendered answer tool call
 */
export const AnalysisAnswer = React.memo(function AnalysisAnswer(
  props: AnalysisAnswerProps,
) {
  return (
    <div className="flex flex-col gap-5">
      <MessageContainer
        isSuccess={true}
        // borderColor={
        //   props.isAnswer ? getBorderColor('answer') : getBorderColor('thinking')
        // }
        type={props.isAnswer ? 'answer' : 'thinking'}
        content={props}
      >
        <Markdown className="prose dark:prose-invert max-w-none text-sm">
          {props.content}
        </Markdown>
      </MessageContainer>
    </div>
  );
});
