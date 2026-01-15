import React from 'react';
import {Components} from 'react-markdown';
import {AnalysisAnswer} from './AnalysisAnswer';
import {ReasoningBox} from './ReasoningBox';
import {ToolPartRenderer} from './ToolPartRenderer';
import {
  isTextPart,
  isReasoningPart,
  isDynamicToolPart,
  isToolPart,
} from '../utils';
import type {ToolGroup} from '../hooks/useToolGrouping';

/**
 * Props for the GroupedMessageParts component
 */
type GroupedMessagePartsProps = {
  /** Array of grouped parts from useToolGrouping hook */
  groupedParts: ToolGroup[];
  /** Total number of message parts (used to determine if a text part is the final answer) */
  totalPartsCount: number;
  /** Per-session additional data keyed by toolCallId */
  toolAdditionalData?: Record<string, unknown>;
  /** Optional custom components for markdown rendering */
  customMarkdownComponents?: Partial<Components>;
};

/**
 * Component that renders message parts with ReasoningBox grouping.
 * Groups consecutive tool parts into collapsible ReasoningBox components.
 *
 * @component
 * @param props - Component props
 * @returns A React component displaying the grouped message parts
 */
export const GroupedMessageParts: React.FC<GroupedMessagePartsProps> = ({
  groupedParts,
  totalPartsCount,
  toolAdditionalData,
  customMarkdownComponents,
}) => {
  return (
    <>
      {groupedParts.map((group, groupIndex) => {
        if (group.type === 'text') {
          const part = group.parts[0];
          if (!part || !isTextPart(part)) return null;
          return (
            <AnalysisAnswer
              key={`group-${groupIndex}`}
              content={part.text}
              isAnswer={group.startIndex === totalPartsCount - 1}
              customMarkdownComponents={customMarkdownComponents}
            />
          );
        }

        if (group.type === 'reasoning') {
          const part = group.parts[0];
          if (!part || !isReasoningPart(part)) return null;
          return (
            <div
              key={`group-${groupIndex}`}
              className="text-muted-foreground text-xs"
            >
              {part.text}
            </div>
          );
        }

        if (group.type === 'tool-group') {
          return (
            <ReasoningBox
              key={`group-${groupIndex}`}
              title={group.title}
              defaultOpen={group.defaultExpanded}
            >
              {group.parts.map((part, partIndex) =>
                isToolPart(part) || isDynamicToolPart(part) ? (
                  <ToolPartRenderer
                    key={`tool-call-${groupIndex}-${partIndex}`}
                    part={part}
                    toolCallId={part.toolCallId}
                    toolAdditionalData={toolAdditionalData}
                  />
                ) : null,
              )}
            </ReasoningBox>
          );
        }

        return null;
      })}
    </>
  );
};
