import React, {useState} from 'react';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import {MessageContainer} from './MessageContainer';

type AnalysisAnswerProps = {
  content: string;
  isAnswer: boolean;
};

/**
 * Renders an analysis answer with markdown content of the final streaming response.
 * Supports streaming think content that may arrive in chunks (e.g., "<think>Hello" before "</think>").
 *
 * @param {AnalysisAnswerProps} props - The component props. See {@link AnalysisAnswerProps} for more details.
 * @returns {JSX.Element} The rendered answer tool call
 */
export const AnalysisAnswer = React.memo(function AnalysisAnswer(
  props: AnalysisAnswerProps,
) {
  const THINK_WORD_LIMIT = 10;
  const [expandedThink, setExpandedThink] = useState<Set<string>>(new Set());

  const toggleThinkExpansion = (content: string) => {
    const newExpanded = new Set(expandedThink);
    if (newExpanded.has(content)) {
      newExpanded.delete(content);
    } else {
      newExpanded.add(content);
    }
    setExpandedThink(newExpanded);
  };

  const truncateText = (text: string, maxWords: number = THINK_WORD_LIMIT) => {
    const words = text.split(' ');
    if (words.length <= maxWords) return text;
    return words.slice(0, maxWords).join(' ') + '...';
  };

  // Process content and extract think content in one pass
  const processContent = (originalContent: string) => {
    let processedContent = originalContent;
    const thinkContents: string[] = [];
    const isCompleteThink: boolean[] = [];
    let index = 0;

    // Replace complete think tags
    const completeThinkRegex = /<think>([\s\S]*?)<\/think>/g;
    let completeMatch;

    while (
      (completeMatch = completeThinkRegex.exec(originalContent)) !== null
    ) {
      if (completeMatch[0] && completeMatch[1]) {
        const content = completeMatch[1].trim();
        thinkContents.push(content);
        isCompleteThink.push(true);
        const marker = `\n\n<think-block data-index="${index}"></think-block>\n\n`;
        processedContent = processedContent.replace(completeMatch[0], marker);
        index++;
      }
    }

    // Replace incomplete think tags (no closing tag)
    const incompleteThinkRegex = /<think>([\s\S]*)$/;
    const incompleteMatch = processedContent.match(incompleteThinkRegex);

    if (incompleteMatch && incompleteMatch[0] && incompleteMatch[1]) {
      const content = incompleteMatch[1].trim();
      thinkContents.push(content);
      isCompleteThink.push(false);
      const marker = `\n\n<think-block data-index="${index}"></think-block>\n\n`;
      processedContent = processedContent.replace(incompleteMatch[0], marker);
    }

    return {processedContent, thinkContents, isCompleteThink};
  };

  const {processedContent, thinkContents, isCompleteThink} = processContent(
    props.content,
  );

  return (
    <div className="flex flex-col gap-5">
      <MessageContainer
        isSuccess={true}
        type={props.isAnswer ? 'answer' : 'thinking'}
        content={props}
      >
        <Markdown
          className="prose dark:prose-invert max-w-none text-sm"
          rehypePlugins={[rehypeRaw]}
          components={{
            // @ts-expect-error - Custom HTML element not in react-markdown types
            'think-block': (thinkBlock) => {
              const index = parseInt(thinkBlock.props?.['data-index'] || '0');
              const content = thinkContents[index] || '';
              const isComplete = isCompleteThink[index] || false;

              const isExpanded = expandedThink.has(content);
              // Only truncate if the think block is complete
              const displayText =
                isComplete && !isExpanded ? truncateText(content) : content;
              const needsTruncation =
                isComplete && content.split(' ').length > THINK_WORD_LIMIT;

              return (
                <div key={`think-${index}`} className="inline-block">
                  <span className="rounded-lg bg-gray-50 px-3 py-2 text-sm font-normal text-gray-100 dark:bg-gray-800/50 dark:text-gray-400">
                    <span className="inline-flex items-start gap-2">
                      <span className="text-gray-400">
                        <span className="inline-block opacity-60 grayscale">
                          💭
                        </span>{' '}
                        {displayText}
                      </span>
                    </span>
                    {needsTruncation && (
                      <button
                        onClick={() => toggleThinkExpansion(content)}
                        className="ml-2 text-xs text-gray-500 underline hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                      >
                        {isExpanded ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </span>
                </div>
              );
            },
          }}
        >
          {processedContent}
        </Markdown>
      </MessageContainer>
    </div>
  );
});
