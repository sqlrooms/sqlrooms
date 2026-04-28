import {AgentChat} from '@sqlrooms/ai-core';
import type {AgentChatProps, ToolRenderBehavior} from '@sqlrooms/ai-core';
import {
  Button,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  cn,
} from '@sqlrooms/ui';
import React, {useMemo, type ReactNode} from 'react';
import {useStore} from 'zustand';
import {SkillDraftPreview} from './SkillDraftPreview';
import type {SkillDraftStatus, SkillDraftStore} from './createSkillDraftStore';

export type SkillAuthoringPanelProps = {
  /**
   * The authoring agent. Typically produced by
   * `createSkillAuthoringAgent` and held by the host for the lifetime of the
   * wizard.
   */
  agent: AgentChatProps['agent'];
  /** The draft store shared between the agent's tools and the preview pane. */
  draftStore: SkillDraftStore;
  /** Fired when the user clicks Cancel. The host decides what to close. */
  onCancel: () => void;
  /** Optional chips shown on an empty chat. */
  initialSuggestions?: string[];
  /**
   * Optional header rendered above the split pane. Omit when the host is
   * already providing titling (for example, a `Dialog` with its own
   * `DialogTitle`) to avoid duplicate headings. Callers that render this
   * panel outside a dialog can pass `<DefaultSkillAuthoringPanelHeader />`
   * or any custom node.
   */
  header?: ReactNode;
  className?: string;
};

/**
 * Split-pane authoring surface: left is the `AgentChat` driving a
 * `SkillAuthoringAgent`, right is a live `SkillDraftPreview`. There is no
 * explicit Save button — the agent calls `saveSkill` once the draft is
 * complete, and the status pill in the footer communicates progress.
 *
 * The top header is intentionally opt-in via `header?`. When the panel is
 * rendered inside a `Dialog` the host's `DialogTitle` should own titling;
 * when rendered standalone (for example, as a tab or an inline page) the
 * caller can pass `<DefaultSkillAuthoringPanelHeader />`.
 */
export const SkillAuthoringPanel: React.FC<SkillAuthoringPanelProps> = ({
  agent,
  draftStore,
  onCancel,
  initialSuggestions,
  header,
  className,
}) => {
  const status = useStore(draftStore, (s) => s.status);
  const error = useStore(draftStore, (s) => s.error);

  const toolRenderBehavior = useMemo<ToolRenderBehavior>(
    () => ({
      getActivityLabel: (toolCall) => {
        switch (toolCall.toolName) {
          case 'writeManifest':
            return 'Drafting the manifest';
          case 'writeInstructions':
            return 'Writing instructions';
          case 'saveSkill':
            return 'Saving the skill';
          default:
            return undefined;
        }
      },
    }),
    [],
  );

  return (
    <div className={cn('flex h-full w-full flex-col', className)}>
      {header}

      <div className="min-h-0 flex-1">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={60} minSize={30}>
            <AgentChat
              agent={agent}
              initialSuggestions={initialSuggestions}
              toolRenderBehavior={toolRenderBehavior}
              placeholder="Describe the skill you want to build..."
              className="h-full"
            />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={40} minSize={30}>
            <SkillDraftPreview draftStore={draftStore} className="h-full" />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <div className="border-border flex items-center justify-between gap-2 border-t px-4 py-2">
        <div className="flex items-center gap-2">
          <StatusPill status={status} />
          {status === 'error' && error && (
            <span className="text-destructive text-xs">{error}</span>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};

/**
 * Default header suitable for standalone (non-dialog) hosts. Pass to
 * `SkillAuthoringPanel.header` when there is no outer `DialogTitle`.
 */
export const DefaultSkillAuthoringPanelHeader: React.FC = () => (
  <div className="border-border flex flex-col gap-0.5 border-b px-4 py-3">
    <div className="text-base font-semibold">New skill with AI</div>
    <div className="text-muted-foreground text-xs">
      Describe the skill you want. The agent will draft the manifest and
      instructions.
    </div>
  </div>
);

const StatusPill: React.FC<{
  status: SkillDraftStatus;
}> = ({status}) => {
  const label =
    status === 'saving' ? 'Saving...' : status === 'error' ? 'Error' : 'Ready';

  const dotClass =
    status === 'saving'
      ? 'bg-amber-500 animate-pulse'
      : status === 'error'
        ? 'bg-destructive'
        : 'bg-muted-foreground/40';

  return (
    <div
      className={cn(
        'bg-muted/40 border-border text-muted-foreground flex items-center gap-2 rounded-md border px-3 py-1 text-xs',
        status === 'error' && 'text-destructive border-destructive/40',
      )}
    >
      <span className={cn('inline-block h-1.5 w-1.5 rounded-full', dotClass)} />
      <span>{label}</span>
    </div>
  );
};
