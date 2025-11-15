import React, {useMemo} from 'react';
import {MapIcon, BarChart3Icon} from 'lucide-react';
import {isTextPart, isReasoningPart, isToolPart} from '../utils';
import type {UIMessagePart} from '@sqlrooms/ai-config';

/**
 * Type for a grouped message part (from useToolGrouping hook)
 */
export type ToolGroup = {
  type: 'text' | 'reasoning' | 'tool-group';
  parts: UIMessagePart[];
  startIndex: number;
  title?: React.ReactNode;
  /** Whether the ReasoningBox should be expanded by default (default: false) */
  defaultExpanded?: boolean;
};

/**
 * Custom hook to group consecutive tool parts and generate titles
 * @param uiMessageParts - Array of UI message parts from the assistant
 * @param containerWidth - Width of the container in pixels (for calculating truncation)
 * @param exclude - Array of tool names that should not be grouped and must be rendered separately
 * @param toolAdditionalData - Additional data for tool calls (e.g., agent tool execution details)
 * @returns Grouped parts with generated titles for tool groups
 */
export function useToolGrouping(
  uiMessageParts: UIMessagePart[],
  containerWidth: number = 0,
  exclude: string[] = [],
  toolAdditionalData: Record<string, unknown> = {}
): ToolGroup[] {
  return useMemo(() => {
    if (!uiMessageParts.length) return [];

    // Helper function to check if a part is a tool part (including dynamic-tool)
    const isAnyToolPart = (
      part: UIMessagePart | undefined,
    ): boolean => {
      if (!part) return false;
      if (isToolPart(part)) return true;
      // Also check for dynamic-tool type
      return typeof part.type === 'string' && part.type === 'dynamic-tool';
    };

    // Helper function to check if a tool part should be excluded from grouping
    const isExcludedTool = (part: UIMessagePart): boolean => {
      if (!isAnyToolPart(part)) return false;
      const toolName = getToolName(part);
      return exclude.includes(toolName);
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
        groups.push({
          type: 'reasoning',
          parts: [part],
          startIndex: i,
        });
        i++;
      } else if (isAnyToolPart(part)) {
        // If this tool is excluded, render it separately and expand by default
        if (isExcludedTool(part)) {
          groups.push({
            type: 'tool-group',
            parts: [part],
            startIndex: i,
            title: generateToolGroupTitle([part], false, containerWidth, toolAdditionalData),
            defaultExpanded: true, // Excluded tools are expanded by default
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
            (nextPart.type === 'step-start' || nextPart.type.startsWith('step-'))
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

        // Check if the next group (before any text/reasoning) has more tool parts
        // If there's a text or reasoning part before the next tool, this reasoning chain is complete
        let hasMoreToolsAfter = false;
        for (let k = j; k < uiMessageParts.length; k++) {
          const nextPart = uiMessageParts[k];
          if (!nextPart) continue;

          // If we hit a text or reasoning part, the reasoning chain is broken
          if (isTextPart(nextPart) || isReasoningPart(nextPart)) {
            hasMoreToolsAfter = false;
            break;
          }

          // If we find another tool part, reasoning continues (but only if it's not excluded)
          if (isAnyToolPart(nextPart) && !isExcludedTool(nextPart)) {
            hasMoreToolsAfter = true;
            break;
          }

          // Otherwise (step-start, etc.), keep looking
        }

        // Generate title for this tool group
        const title = generateToolGroupTitle(toolParts, hasMoreToolsAfter, containerWidth, toolAdditionalData);

        groups.push({
          type: 'tool-group',
          parts: toolParts,
          startIndex: i,
          title,
        });
        i = j;
      } else {
        i++;
      }
    }

    return groups;
  }, [uiMessageParts, containerWidth, exclude, toolAdditionalData]);
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

/**
 * Get icon component based on tool name
 */
function getToolIcon(toolName: string): React.ReactNode | null {
  if (toolName === 'createMapLayer') {
    return <MapIcon className="h-3 w-3 text-blue-500 shrink-0" />;
  }
  if (toolName === 'chart') {
    return <BarChart3Icon className="h-3 w-3 text-green-500 shrink-0" />;
  }
  return null;
}

/**
 * Generate a dynamic title for a tool group based on completion status and reasoning
 * @param toolParts - The tool parts in this group
 * @param hasMoreToolsAfter - Whether there are more tool calls after this group
 * @param containerWidth - Width of the container in pixels (for calculating truncation)
 * @param toolAdditionalData - Additional data for tool calls (e.g., agent tool execution details)
 */
function generateToolGroupTitle(toolParts: UIMessagePart[], hasMoreToolsAfter: boolean, containerWidth: number, toolAdditionalData: Record<string, unknown> = {}): React.ReactNode {
  // Filter to only tool parts
  const actualToolParts = toolParts.filter(
    (p) =>
      p &&
      (isToolPart(p) ||
        (typeof p.type === 'string' && p.type === 'dynamic-tool')),
  );

  if (actualToolParts.length === 0) return 'Thought';

  // Check if all tools in this group are completed
  const allCompleted = actualToolParts.every((p) => {
    const state = (p as any).state;
    return state === 'output-available' || state === 'output-error';
  });

  const toolCount = actualToolParts.length;

  // Collect all unique tool names to determine icons
  const toolNames = new Set(
    actualToolParts.map((p) => getToolName(p)).filter((name) => name !== 'unknown')
  );

  // Check if any of the tools are agent tools
  const hasAgentTool = Array.from(toolNames).some((name) => name.startsWith('agent-'));

  // Check if we have both 'createMapLayer' and 'chart' tools
  const hasMapLayer = toolNames.has('createMapLayer');
  const hasChart = toolNames.has('chart');

  // Generate icons - show both if both types are present
  let icon: React.ReactNode | null = null;
  if (hasMapLayer && hasChart) {
    icon = (
      <span className="flex items-center gap-1">
        <MapIcon className="h-3 w-3 text-blue-500 shrink-0" />
        <BarChart3Icon className="h-3 w-3 text-green-500 shrink-0" />
      </span>
    );
  } else if (hasMapLayer) {
    icon = <MapIcon className="h-3 w-3 text-blue-500 shrink-0" />;
  } else if (hasChart) {
    icon = <BarChart3Icon className="h-3 w-3 text-green-500 shrink-0" />;
  } else {
    // Fallback to first tool icon if neither map nor chart
    const firstToolPart = actualToolParts[0];
    const firstToolName = firstToolPart ? getToolName(firstToolPart) : 'unknown';
    icon = getToolIcon(firstToolName);
  }

  // Show "Thinking..." if:
  // 1. Tools are not completed yet, OR
  // 2. Tools are completed but there are more tool calls coming after
  const isStillThinking = !allCompleted || hasMoreToolsAfter;

  if (isStillThinking) {
    // For active thinking, show reasoning text if available
    const lastToolPart = actualToolParts[actualToolParts.length - 1];
    const reasoning = lastToolPart
      ? ((lastToolPart as any).input?.reasoning as string | undefined)
      : undefined;

    // Use different base title for agent tools
    let baseTitle: string;
    if (hasAgentTool) {
      // Extract agent tool names from toolAdditionalData
      const agentToolNames: string[] = [];
      for (const toolPart of actualToolParts) {
        const toolCallId = (toolPart as any).toolCallId;
        if (toolCallId && toolAdditionalData[toolCallId]) {
          const agentData = toolAdditionalData[toolCallId] as {
            agentToolCalls?: Array<{toolName: string; state: string}>;
          };
          if (agentData?.agentToolCalls) {
            // Get currently executing or pending agent tools
            const executingTools = agentData.agentToolCalls
              .filter((call) => call.state === 'pending' || call.state === 'success')
              .map((call) => call.toolName);
            agentToolNames.push(...executingTools);
          }
        }
      }

      // Remove duplicates
      const uniqueToolNames = Array.from(new Set(agentToolNames));

      if (uniqueToolNames.length > 0) {
        const toolNamesList = uniqueToolNames.join(', ');
        baseTitle = uniqueToolNames.length === 1
          ? `Agent is calling: ${toolNamesList}...`
          : `Agent is calling: ${toolNamesList}...`;
      } else {
        // No agent tools are currently executing, fall back to regular "Thinking..."
        baseTitle = toolCount === 1 ? 'Thinking...' : `Thinking... (${toolCount} tools)`;
      }
    } else {
      baseTitle = toolCount === 1 ? 'Thinking...' : `Thinking... (${toolCount} tools)`;
    }

    // Calculate max reasoning length based on container width
    // Estimate: average character width ~7px, reserve space for icon (~24px), padding (~16px), and base text
    const baseTextWidth = baseTitle.length * 7; // Rough estimate for "Thinking..." or "Thinking... (X tools)"
    const iconWidth = 24; // Space for icon(s)
    const padding = 16; // Padding and gaps
    const availableWidth = containerWidth > 0 ? containerWidth - baseTextWidth - iconWidth - padding : 0;
    // Estimate characters that fit: divide by average char width (~7px), with a minimum of 20 and max of 150
    // Removed hard cap of 60 to allow scaling with container width
    const maxReasoningLength = containerWidth > 0
      ? Math.max(20, Math.min(150, Math.floor(availableWidth / 7)))
      : 40; // Fallback to 40 if width not available

    const truncatedReasoning =
      reasoning && reasoning.length > maxReasoningLength
        ? `${reasoning.substring(0, maxReasoningLength).toLowerCase()}...`
        : reasoning?.toLowerCase();

    const titleText = truncatedReasoning ? `${baseTitle} ${truncatedReasoning}` : baseTitle;
    return (
      <span className="flex w-full items-center justify-between text-orange-400">
        <span className="truncate">{titleText}</span>
        {icon}
      </span>
    );
  } else {
    // For completed thoughts (and no more tools after), just show tool count without reasoning
    const titleText = toolCount === 1 ? 'Thought (1 tool)' : `Thought (${toolCount} tools)`;
    return (
      <span className="flex w-full items-center justify-between text-orange-400">
        <span className="truncate">{titleText}</span>
        {icon}
      </span>
    );
  }
}

