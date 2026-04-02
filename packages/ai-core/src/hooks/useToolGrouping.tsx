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
  /** Whether tool calls in this group are still executing */
  isRunning?: boolean;
  /** Tool call IDs in this group, used to derive elapsed time from tool-level store entries */
  toolCallIds?: string[];
  /** If the group contains a single agent tool, its toolCallId for live sub-reasoning */
  agentToolCallId?: string;
};

/**
 * Custom hook to group consecutive tool parts and generate titles
 * @param uiMessageParts - Array of UI message parts from the assistant
 * @param containerWidth - Width of the container in pixels (for calculating truncation)
 * @param exclude - Array of tool names that should not be grouped and must be rendered separately
 * @param toolDisplayNames - Optional map from tool name to human-readable display name
 * @returns Grouped parts with generated titles for tool groups
 */
export function useToolGrouping(
  uiMessageParts: UIMessagePart[],
  containerWidth: number = 0,
  exclude: string[] = [],
  toolDisplayNames: Record<string, string> = {},
): ToolGroup[] {
  return useMemo(() => {
    if (!uiMessageParts.length) return [];

    // Helper function to check if a part is a tool part (including dynamic-tool)
    const isAnyToolPart = (part: UIMessagePart | undefined): boolean => {
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
          const excludedIsRunning = !(
            (part as any).state === 'output-available' ||
            (part as any).state === 'output-error'
          );
          const excludedKey = (part as any).toolCallId as string | undefined;

          groups.push({
            type: 'tool-group',
            parts: [part],
            startIndex: i,
            title: generateToolGroupTitle(
              [part],
              containerWidth,
              toolDisplayNames,
            ),
            defaultExpanded: true,
            isRunning: excludedIsRunning,
            toolCallIds: excludedKey ? [excludedKey] : [],
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

        const title = generateToolGroupTitle(
          toolParts,
          containerWidth,
          toolDisplayNames,
        );

        const groupIsRunning = toolParts.some(
          (p) =>
            !(
              (p as any).state === 'output-available' ||
              (p as any).state === 'output-error'
            ),
        );
        const groupToolCallIds = toolParts
          .map((p) => (p as any).toolCallId as string | undefined)
          .filter((id): id is string => !!id);

        const agentPart = toolParts.find((p) =>
          getToolName(p).startsWith('agent-'),
        );
        const agentToolCallId = agentPart
          ? ((agentPart as any).toolCallId as string | undefined)
          : undefined;

        groups.push({
          type: 'tool-group',
          parts: toolParts,
          startIndex: i,
          title,
          isRunning: groupIsRunning,
          toolCallIds: groupToolCallIds,
          agentToolCallId,
        });
        i = j;
      } else {
        i++;
      }
    }

    return groups;
  }, [uiMessageParts, containerWidth, exclude, toolDisplayNames]);
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
    return <MapIcon className="h-3 w-3 shrink-0 text-blue-500" />;
  }
  if (toolName === 'chart') {
    return <BarChart3Icon className="h-3 w-3 shrink-0 text-green-500" />;
  }
  return null;
}

/**
 * Fallback: convert a kebab/camelCase tool name to a readable title.
 * e.g. "agent-weather" -> "Agent Weather", "createMapLayer" -> "Create Map Layer"
 */
function formatToolNameFallback(name: string): string {
  return name
    .replace(/-/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const AVG_CHAR_WIDTH_PX = 7;
const ICON_WIDTH_PX = 24;
const PADDING_PX = 16;
const DEFAULT_MAX_CHARS = 40;
const MIN_MAX_CHARS = 20;
const ABSOLUTE_MAX_CHARS = 150;

/**
 * Truncate a string to fit within available container width, accounting for
 * a fixed prefix (e.g. base title) and reserved space for icons/padding.
 *
 * @param text - The text to truncate
 * @param containerWidth - Container width in pixels (0 = use default)
 * @param prefixLength - Number of characters already consumed by a prefix label
 * @returns The (possibly truncated) text, or undefined if input was undefined
 */
export function truncateToFit(
  text: string | undefined,
  containerWidth: number,
  prefixLength: number = 0,
): string | undefined {
  if (!text) return undefined;

  const prefixWidth = prefixLength * AVG_CHAR_WIDTH_PX;
  const availableWidth =
    containerWidth > 0
      ? containerWidth - prefixWidth - ICON_WIDTH_PX - PADDING_PX
      : 0;
  const maxChars =
    containerWidth > 0
      ? Math.max(
          MIN_MAX_CHARS,
          Math.min(
            ABSOLUTE_MAX_CHARS,
            Math.floor(availableWidth / AVG_CHAR_WIDTH_PX),
          ),
        )
      : DEFAULT_MAX_CHARS;

  return text.length > maxChars ? `${text.substring(0, maxChars)}…` : text;
}

/**
 * Generate a dynamic title for a tool group based on completion status and reasoning
 * @param toolParts - The tool parts in this group
 * @param containerWidth - Width of the container in pixels (for calculating truncation)
 * @param toolDisplayNames - Optional map from tool name to human-readable display name
 */
function generateToolGroupTitle(
  toolParts: UIMessagePart[],
  containerWidth: number,
  toolDisplayNames: Record<string, string> = {},
): React.ReactNode {
  // Filter to only tool parts
  const actualToolParts = toolParts.filter(
    (p) =>
      p &&
      (isToolPart(p) ||
        (typeof p.type === 'string' && p.type === 'dynamic-tool')),
  );

  if (actualToolParts.length === 0) return 'Processing';

  // Check if all tools in this group are completed
  const allCompleted = actualToolParts.every((p) => {
    const state = (p as any).state;
    return state === 'output-available' || state === 'output-error';
  });

  const toolCount = actualToolParts.length;

  // Collect all unique tool names to determine icons and display names
  const toolNamesList = actualToolParts
    .map((p) => getToolName(p))
    .filter((name) => name !== 'unknown');
  const toolNames = new Set(toolNamesList);

  // Resolve unique display names (preserving insertion order, dedup by label)
  const uniqueDisplayNames: string[] = [];
  const seenLabels = new Set<string>();
  for (const name of toolNamesList) {
    const label = toolDisplayNames[name] ?? formatToolNameFallback(name);
    if (!seenLabels.has(label)) {
      seenLabels.add(label);
      uniqueDisplayNames.push(label);
    }
  }
  const toolLabel = uniqueDisplayNames.join(', ') || 'Tool';

  // Check if we have both 'createMapLayer' and 'chart' tools
  const hasMapLayer = toolNames.has('createMapLayer');
  const hasChart = toolNames.has('chart');

  // Generate icons - show both if both types are present
  let icon: React.ReactNode | null = null;
  if (hasMapLayer && hasChart) {
    icon = (
      <span className="flex items-center gap-1">
        <MapIcon className="h-3 w-3 shrink-0 text-blue-500" />
        <BarChart3Icon className="h-3 w-3 shrink-0 text-green-500" />
      </span>
    );
  } else if (hasMapLayer) {
    icon = <MapIcon className="h-3 w-3 shrink-0 text-blue-500" />;
  } else if (hasChart) {
    icon = <BarChart3Icon className="h-3 w-3 shrink-0 text-green-500" />;
  } else {
    // Fallback to first tool icon if neither map nor chart
    const firstToolPart = actualToolParts[0];
    const firstToolName = firstToolPart
      ? getToolName(firstToolPart)
      : 'unknown';
    icon = getToolIcon(firstToolName);
  }

  const isStillThinking = !allCompleted;

  if (isStillThinking) {
    const lastToolPart = actualToolParts[actualToolParts.length - 1];
    const reasoning = lastToolPart
      ? ((lastToolPart as any).input?.reasoning as string | undefined)
      : undefined;

    const baseTitle = `Running ${toolLabel}...`;
    const truncatedReasoning = truncateToFit(
      reasoning,
      containerWidth,
      baseTitle.length,
    );

    const titleText = truncatedReasoning
      ? `${baseTitle} ${truncatedReasoning}`
      : baseTitle;
    return (
      <span className="flex w-full items-center justify-between">
        <span className="truncate">{titleText}</span>
        {icon}
      </span>
    );
  } else {
    const titleText =
      toolCount === 1 ? toolLabel : `${toolLabel} (${toolCount})`;
    return (
      <span className="flex w-full items-center justify-between">
        <span className="truncate">{titleText}</span>
        {icon}
      </span>
    );
  }
}
