import React from 'react';
import type {UIMessagePart} from '@sqlrooms/ai-config';
import {Components} from 'react-markdown';
import {AnalysisAnswer} from './AnalysisAnswer';
import {ToolPartRenderer} from './ToolPartRenderer';
import {
  isTextPart,
  isReasoningPart,
  isToolPart,
  isDynamicToolPart,
} from '../utils';

/**
 * Props for the MessagePartsList component
 */
type MessagePartsListProps = {
  /** Array of UI message parts to render */
  parts: UIMessagePart[];
  /** Per-session additional data keyed by toolCallId */
  toolAdditionalData?: Record<string, unknown>;
  /** Optional custom components for markdown rendering */
  customMarkdownComponents?: Partial<Components>;
};

/**
 * Component that renders message parts directly without grouping.
 * Used when ReasoningBox grouping is disabled.
 *
 * @component
 * @param props - Component props
 * @returns A React component displaying the message parts
 */
export const MessagePartsList: React.FC<MessagePartsListProps> = ({
  parts,
  toolAdditionalData,
  customMarkdownComponents,
}) => {
  return (
    <>
      {parts.map((part, index) => {
        if (isTextPart(part)) {
          return (
            <AnalysisAnswer
              key={index}
              content={part.text}
              isAnswer={index === parts.length - 1}
              customMarkdownComponents={customMarkdownComponents}
            />
          );
        }
        if (isReasoningPart(part)) {
          return (
            <div key={index} className="text-muted-foreground text-xs">
              {part.text}
            </div>
          );
        }
        if (isToolPart(part) || isDynamicToolPart(part)) {
          return (
            <ToolPartRenderer
              key={`tool-call-${index}`}
              part={part}
              toolCallId={part.toolCallId}
              toolAdditionalData={toolAdditionalData}
            />
          );
        }
        return null;
      })}
    </>
  );
};
