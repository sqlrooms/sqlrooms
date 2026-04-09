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
import {useToolTimingRecorder} from '../hooks/useToolTimingRecorder';

/**
 * Headless component that records tool timing regardless of whether the
 * parent ReasoningBox is expanded. Without this, timing data is only
 * recorded when ToolPartRenderer mounts (i.e. when the box is open).
 */
const ToolTimingBridge: React.FC<{
  toolCallId: string;
  isComplete: boolean;
}> = ({toolCallId, isComplete}) => {
  useToolTimingRecorder(toolCallId, isComplete);
  return null;
};

/**
 * Props for the GroupedMessageParts component
 */
type GroupedMessagePartsProps = {
  /** Array of grouped parts from useToolGrouping hook */
  groupedParts: ToolGroup[];
  /** Total number of message parts (used to determine if a text part is the final answer) */
  totalPartsCount: number;
  /** Optional custom components for markdown rendering */
  customMarkdownComponents?: Partial<Components>;
};

/**
 * Component that renders message parts with ReasoningBox grouping.
 * Every tool-group is wrapped in a ReasoningBox. Groups that contain an
 * agent or a tool with a visual renderer are expanded by default so
 * their output is visible immediately, while regular tool groups start
 * collapsed. This design supports arbitrary nesting — an expanded agent
 * ReasoningBox can contain child ReasoningBoxes for its own tool calls.
 *
 * @component
 * @param props - Component props
 * @returns A React component displaying the grouped message parts
 */
export const GroupedMessageParts: React.FC<GroupedMessagePartsProps> = ({
  groupedParts,
  totalPartsCount,
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
            <ReasoningBox
              key={`group-${groupIndex}`}
              title="Reasoning"
              isRunning={group.isRunning}
            >
              <div className="text-muted-foreground text-xs">{part.text}</div>
            </ReasoningBox>
          );
        }

        if (group.type === 'tool-group') {
          return (
            <React.Fragment key={`group-${groupIndex}`}>
              {group.parts.map((part) => {
                if (!isToolPart(part) && !isDynamicToolPart(part)) return null;
                const complete =
                  part.state === 'output-available' ||
                  part.state === 'output-error' ||
                  part.state === 'output-denied';
                return (
                  <ToolTimingBridge
                    key={`timing-${part.toolCallId}`}
                    toolCallId={part.toolCallId}
                    isComplete={complete}
                  />
                );
              })}
              <ReasoningBox
                title={group.title}
                defaultOpen={group.defaultExpanded}
                isRunning={group.isRunning}
                toolCallIds={group.toolCallIds}
              >
                {group.parts.map((part, partIndex) =>
                  isToolPart(part) || isDynamicToolPart(part) ? (
                    <ToolPartRenderer
                      key={`tool-call-${groupIndex}-${partIndex}`}
                      part={part}
                      toolCallId={part.toolCallId}
                    />
                  ) : null,
                )}
              </ReasoningBox>
            </React.Fragment>
          );
        }

        return null;
      })}
    </>
  );
};
