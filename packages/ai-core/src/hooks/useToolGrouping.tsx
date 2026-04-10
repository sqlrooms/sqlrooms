import React, {useMemo} from 'react';
import {MapIcon, BarChart3Icon} from 'lucide-react';
import {
  isTextPart,
  isReasoningPart,
  isToolPart,
  generateReasoningTitle,
} from '../utils';
import type {ToolCallSummary} from '../utils';
import type {UIMessagePart} from '@sqlrooms/ai-config';
import {
  getReasoningRightLabel,
  ReasoningTitle,
} from '../components/ReasoningBox';

/**
 * Type for a grouped message part (from useToolGrouping hook)
 */
export type ToolGroup = {
  type: 'text' | 'reasoning' | 'tool-group';
  parts: UIMessagePart[];
  startIndex: number;
  title?: React.ReactNode;
  /** Label pinned to the right edge, aligned across nesting levels. */
  rightLabel?: React.ReactNode;
  /** Whether the ReasoningBox should be expanded by default (default: false) */
  defaultExpanded?: boolean;
  /** Whether this group is still running (has incomplete tool calls or more tools after) */
  isRunning?: boolean;
  /** The toolCallIds in this group (for elapsed time) */
  toolCallIds?: string[];
};

/**
 * Custom hook to group consecutive tool parts and generate titles
 * @param uiMessageParts - Array of UI message parts from the assistant
 * @param containerWidth - Unused, kept for backward compatibility
 * @param exclude - Array of tool names that should not be grouped and must be rendered separately
 * @returns Grouped parts with generated titles for tool groups
 */
export function useToolGrouping(
  uiMessageParts: UIMessagePart[],
  _containerWidth: number = 0,
  exclude: string[] = [],
): ToolGroup[] {
  const groups = useMemo(() => {
    if (!uiMessageParts.length) return [];

    // Helper function to check if a part is a tool part (including dynamic-tool)
    const isAnyToolPart = (part: UIMessagePart | undefined): boolean => {
      if (!part) return false;
      if (isToolPart(part)) return true;
      // Also check for dynamic-tool type
      return typeof part.type === 'string' && part.type === 'dynamic-tool';
    };

    // Helper function to check if a tool part should be excluded from grouping.
    // Agent tools (name starts with "agent-") are always excluded so they
    // render outside the ReasoningBox at every nesting level.
    const isExcludedTool = (part: UIMessagePart): boolean => {
      if (!isAnyToolPart(part)) return false;
      const toolName = getToolName(part);
      return toolName.startsWith('agent-') || exclude.includes(toolName);
    };

    const groups: ToolGroup[] = [];

    let i = 0;
    while (i < uiMessageParts.length) {
      const part = uiMessageParts[i];
      if (!part) {
        i++;
        continue;
      }

      if (isTextPart(part)) {
        groups.push({
          type: 'text',
          parts: [part],
          startIndex: i,
        });
        i++;
      } else if (isReasoningPart(part)) {
        const isStreaming = (part as {state?: string}).state !== 'done';
        groups.push({
          type: 'reasoning',
          parts: [part],
          startIndex: i,
          isRunning: isStreaming,
        });
        i++;
      } else if (isAnyToolPart(part)) {
        // If this tool is excluded, render it separately and expand by default
        if (isExcludedTool(part)) {
          const summaries = partsToSummaries([part]);
          const partState = (part as any).state as string;
          const partIsRunning =
            partState !== 'output-available' && partState !== 'output-error';
          const titleDesc = generateReasoningTitle(summaries, partIsRunning);
          groups.push({
            type: 'tool-group',
            parts: [part],
            startIndex: i,
            title: <ReasoningTitle descriptor={titleDesc} />,
            rightLabel: getReasoningRightLabel(titleDesc),
            defaultExpanded: true,
          });
          i++;
          continue;
        }

        // Collect consecutive tool parts (including dynamic-tool)
        // Skip over step-start and other metadata parts between tool calls
        // But exclude tools that are in the exclude list
        const toolParts: UIMessagePart[] = [part];
        let j = i + 1;
        while (j < uiMessageParts.length) {
          const nextPart = uiMessageParts[j];
          if (!nextPart) {
            j++;
            continue;
          }

          // If it's a tool part, check if it should be excluded
          if (isAnyToolPart(nextPart)) {
            // If excluded, stop grouping here
            if (isExcludedTool(nextPart)) {
              break;
            }
            toolParts.push(nextPart);
            j++;
          }
          // If it's a step-start or step-finish, skip it but continue looking for more tools
          else if (
            typeof nextPart.type === 'string' &&
            (nextPart.type === 'step-start' ||
              nextPart.type.startsWith('step-'))
          ) {
            j++;
          }
          // If it's text or reasoning, stop grouping
          else if (isTextPart(nextPart) || isReasoningPart(nextPart)) {
            break;
          }
          // Unknown part type, skip it
          else {
            j++;
          }
        }

        // Check if there are incomplete tool parts after this group in the
        // same reasoning chain (before any text/reasoning break). Only treat
        // the group as "still running" when those subsequent tools have not
        // finished yet — otherwise this is a completed multi-step chain.
        let hasIncompleteToolsAfter = false;
        for (let k = j; k < uiMessageParts.length; k++) {
          const nextPart = uiMessageParts[k];
          if (!nextPart) continue;

          if (isTextPart(nextPart) || isReasoningPart(nextPart)) {
            break;
          }

          if (isAnyToolPart(nextPart) && !isExcludedTool(nextPart)) {
            const nextState = (nextPart as any).state as string | undefined;
            const nextCompleted =
              nextState === 'output-available' ||
              nextState === 'output-error' ||
              nextState === 'output-denied';
            if (!nextCompleted) {
              hasIncompleteToolsAfter = true;
            }
            break;
          }
        }

        // Generate title for this tool group
        const summaries = partsToSummaries(toolParts);

        // Extract toolCallIds for elapsed time tracking
        const actualToolPartsForIds = toolParts.filter(
          (p) =>
            isToolPart(p) ||
            (typeof p.type === 'string' && p.type === 'dynamic-tool'),
        );
        const toolCallIds = actualToolPartsForIds
          .map((p) => (p as {toolCallId?: string}).toolCallId)
          .filter((id): id is string => !!id);

        const allCompleted = actualToolPartsForIds.every((p) => {
          const state = (p as any).state;
          return state === 'output-available' || state === 'output-error';
        });
        const groupIsRunning = !allCompleted || hasIncompleteToolsAfter;

        const titleDesc = generateReasoningTitle(summaries, groupIsRunning);
        const icon = getToolGroupIcon(summaries);
        const title = icon ? (
          <span className="flex w-full items-center justify-between">
            <ReasoningTitle descriptor={titleDesc} />
            {icon}
          </span>
        ) : (
          <ReasoningTitle descriptor={titleDesc} />
        );

        groups.push({
          type: 'tool-group',
          parts: toolParts,
          startIndex: i,
          title,
          isRunning: groupIsRunning,
          toolCallIds,
        });
        i = j;
      } else {
        i++;
      }
    }

    return groups;
  }, [uiMessageParts, exclude]);

  return groups;
}

/**
 * Extract tool name from a tool part
 */
function getToolName(part: UIMessagePart): string {
  if (typeof part.type === 'string' && part.type === 'dynamic-tool') {
    return ((part as any).toolName || 'unknown') as string;
  }
  if (isToolPart(part)) {
    return typeof part.type === 'string'
      ? part.type.replace(/^tool-/, '') || 'unknown'
      : 'unknown';
  }
  return 'unknown';
}

function partsToSummaries(parts: UIMessagePart[]): ToolCallSummary[] {
  return parts
    .filter(
      (p) =>
        p &&
        (isToolPart(p) ||
          (typeof p.type === 'string' && p.type === 'dynamic-tool')),
    )
    .map((p) => {
      const state = (p as any).state as string;
      return {
        toolName: getToolName(p),
        completed: state === 'output-available' || state === 'output-error',
        reasoning: (p as any).input?.reasoning as string | undefined,
      };
    });
}

/**
 * Get icon(s) for a group of tool call summaries based on tool names.
 */
function getToolGroupIcon(
  summaries: ToolCallSummary[],
): React.ReactNode | null {
  const toolNames = new Set(
    summaries.map((s) => s.toolName).filter((n) => n !== 'unknown'),
  );
  const hasMapLayer = toolNames.has('createMapLayer');
  const hasChart = toolNames.has('chart');

  if (hasMapLayer && hasChart) {
    return (
      <span className="flex items-center gap-1">
        <MapIcon className="h-3 w-3 shrink-0 text-blue-500" />
        <BarChart3Icon className="h-3 w-3 shrink-0 text-green-500" />
      </span>
    );
  }
  if (hasMapLayer) {
    return <MapIcon className="h-3 w-3 shrink-0 text-blue-500" />;
  }
  if (hasChart) {
    return <BarChart3Icon className="h-3 w-3 shrink-0 text-green-500" />;
  }
  return null;
}
