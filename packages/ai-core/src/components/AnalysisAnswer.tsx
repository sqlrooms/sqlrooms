import React, {useState, useCallback, useMemo} from 'react';
import Markdown, {Components} from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import {truncate} from '@sqlrooms/utils';
import {MessageContainer} from './MessageContainer';
import {BrainIcon} from 'lucide-react';
import {cn, CopyButton} from '@sqlrooms/ui';

type AnalysisAnswerProps = {
  content: string;
  isAnswer: boolean;
  customMarkdownComponents?: Partial<Components>;
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
  className?: string;
  thinkContent: ThinkContent;
  isExpanded: boolean;
  onToggleExpansion: (content: string) => void;
}>(({thinkContent, isExpanded, onToggleExpansion, className}) => {
  const {content, isComplete, index} = thinkContent;

  const displayText =
    isComplete && !isExpanded ? truncate(content, THINK_WORD_LIMIT) : content;
  const needsTruncation =
    isComplete && content.split(' ').length > THINK_WORD_LIMIT;

  return (
    <span
      key={`think-${index}`}
      className={cn(
        'inline-block rounded-lg px-3 py-2 text-xs font-normal text-gray-100 dark:text-gray-400',
        isExpanded && 'bg-gray-50 dark:bg-gray-800/50',
        className,
      )}
    >
      <span className="inline-flex items-start gap-2">
        <span className="text-gray-400">
          <BrainIcon
            className="mb-1 inline-block opacity-60 grayscale"
            size={12}
          />{' '}
          {displayText}
        </span>
      </span>{' '}
      {needsTruncation && (
        <button
          onClick={() => onToggleExpansion(content)}
          className="text-xs text-gray-500 underline hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          {isExpanded ? 'Show less' : 'Show more thinking'}
        </button>
      )}
    </span>
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
  const {content, isAnswer, customMarkdownComponents} = props;
  const [expandedThink, setExpandedThink] = useState<Set<string>>(new Set());
  const hasMarkdownContent = content.trim().length > 0;

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
    () => processContent(content),
    [content],
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
    <div className="group/assistant-message relative flex flex-col gap-5">
      {hasMarkdownContent && (
        <div className="absolute top-2 right-2 z-10 opacity-0 transition-opacity group-hover/assistant-message:opacity-100">
          <CopyButton
            text={content}
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            ariaLabel={
              isAnswer
                ? 'Copy AI response as Markdown'
                : 'Copy AI message as Markdown'
            }
          />
        </div>
      )}
      <MessageContainer
        isSuccess={true}
        type={isAnswer ? 'answer' : 'thinking'}
        content={{content, isAnswer}}
      >
        <div className="prose dark:prose-invert max-w-none text-sm">
          <Markdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={
              {
                'think-block': thinkBlockComponent,
                ...customMarkdownComponents,
              } as Partial<Components>
            }
          >
            {processedContent}
          </Markdown>
        </div>
      </MessageContainer>
    </div>
  );
});
