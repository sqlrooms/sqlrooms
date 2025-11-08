import React from 'react';
import type {UIMessagePart} from '@sqlrooms/ai-config';
import {AnalysisAnswer} from './AnalysisAnswer';
import {ToolPartRenderer} from './ToolPartRenderer';
import {isTextPart, isReasoningPart, isToolPart} from '../utils';

/**
 * Props for the MessagePartsList component
 */
type MessagePartsListProps = {
  /** Array of UI message parts to render */
  parts: UIMessagePart[];
};

/**
 * Component that renders message parts directly without grouping.
 * Used when ReasoningBox grouping is disabled.
 *
 * @component
 * @param props - Component props
 * @returns A React component displaying the message parts
 */
export const MessagePartsList: React.FC<MessagePartsListProps> = ({parts}) => {
  return (
    <>
      {parts.map((part, index) => {
        if (isTextPart(part)) {
          return (
            <AnalysisAnswer
              key={index}
              content={part.text}
              isAnswer={index === parts.length - 1}
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
        if (isToolPart(part)) {
          return (
            <ToolPartRenderer
              key={`tool-call-${index}`}
              part={part}
            />
          );
        }
        return null;
      })}
    </>
  );
};

