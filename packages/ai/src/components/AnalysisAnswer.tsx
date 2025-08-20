import React, {useState, useCallback, useMemo} from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import {truncate} from '@sqlrooms/utils';
import {MessageContainer} from './MessageContainer';

type AnalysisAnswerProps = {
  content: string;
  isAnswer: boolean;
};

type ThinkContent = {
  content: string;
  isComplete: boolean;
  index: number;
};

// Constants moved outside component to prevent recreation
const THINK_WORD_LIMIT = 10;
const COMPLETE_THINK_REGEX = /<think>([\s\S]*?)<\/think>/g;
const INCOMPLETE_THINK_REGEX = /<think>([\s\S]*)$/;

/**
 * Processes content and extracts think content in one pass
 */
const processContent = (
  originalContent: string,
): {
  processedContent: string;
  thinkContents: ThinkContent[];
} => {
  const thinkContents: ThinkContent[] = [];
  let processedContent = originalContent;
  let index = 0;

  // Replace complete think tags
  processedContent = processedContent.replace(
    COMPLETE_THINK_REGEX,
    (match, content) => {
      if (content) {
        thinkContents.push({
          content: content.trim(),
          isComplete: true,
          index: index++,
        });
        return `\n\n<think-block data-index="${index - 1}"></think-block>\n\n`;
      }
      return match;
    },
  );

  // Replace incomplete think tags (no closing tag)
  processedContent = processedContent.replace(
    INCOMPLETE_THINK_REGEX,
    (match, content) => {
      if (content) {
        thinkContents.push({
          content: content.trim(),
          isComplete: false,
          index: index++,
        });
        return `\n\n<think-block data-index="${index - 1}"></think-block>\n\n`;
      }
      return match;
    },
  );

  return {processedContent, thinkContents};
};

/**
 * ThinkBlock component for rendering individual think blocks
 */
const ThinkBlock = React.memo<{
  thinkContent: ThinkContent;
  isExpanded: boolean;
  onToggleExpansion: (content: string) => void;
}>(({thinkContent, isExpanded, onToggleExpansion}) => {
  const {content, isComplete, index} = thinkContent;

  const displayText =
    isComplete && !isExpanded ? truncate(content, THINK_WORD_LIMIT) : content;
  const needsTruncation =
    isComplete && content.split(' ').length > THINK_WORD_LIMIT;

  return (
    <div
      key={`think-${index}`}
      className="inline-block rounded-lg bg-gray-50 px-3 py-2 text-sm font-normal text-gray-100 dark:bg-gray-800/50 dark:text-gray-400"
    >
      <span className="inline-flex items-start gap-2">
        <span className="text-gray-400">
          <span className="inline-block opacity-60 grayscale">💭</span>{' '}
          {displayText}
        </span>
      </span>{' '}
      {needsTruncation && (
        <button
          onClick={() => onToggleExpansion(content)}
          className="text-xs text-gray-500 underline hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
});

ThinkBlock.displayName = 'ThinkBlock';

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
  const [expandedThink, setExpandedThink] = useState<Set<string>>(new Set());

  const toggleThinkExpansion = useCallback((content: string) => {
    setExpandedThink((prev) => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(content)) {
        newExpanded.delete(content);
      } else {
        newExpanded.add(content);
      }
      return newExpanded;
    });
  }, []);

  // Memoize content processing to avoid recalculation on every render
  const {processedContent, thinkContents} = useMemo(
    () => processContent(props.content),
    [props.content],
  );

  // Memoize the think-block component to prevent unnecessary re-renders
  const thinkBlockComponent = useCallback(
    (thinkBlock: any) => {
      try {
        const index = parseInt(thinkBlock.props?.['data-index'] || '0', 10);
        const thinkContent = thinkContents[index];

        if (!thinkContent) {
          console.warn(`Think content not found for index: ${index}`);
          return null;
        }

        const isExpanded = expandedThink.has(thinkContent.content);

        return (
          <ThinkBlock
            thinkContent={thinkContent}
            isExpanded={isExpanded}
            onToggleExpansion={toggleThinkExpansion}
          />
        );
      } catch (error) {
        console.error('Error rendering think block:', error);
        return null;
      }
    },
    [thinkContents, expandedThink, toggleThinkExpansion],
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
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            // @ts-expect-error - Custom HTML element not in react-markdown types
            'think-block': thinkBlockComponent,
          }}
        >
          {processedContent}
        </Markdown>
      </MessageContainer>
    </div>
  );
});
