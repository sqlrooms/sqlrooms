import type {AbstractChat, ChatStatus, FileUIPart, UIMessage} from 'ai';
import type {
  HarnessRunEvent,
  HarnessConversationSnapshot,
  HarnessStartTurn,
  HarnessApproval,
  HarnessRun,
} from '@sqlrooms/ai-config';

/** Shared message/composer contract for an in-process agent runtime. */
export type LocalAgentChatRuntime = {
  mode: 'local-agent';
  messages: UIMessage[];
  status: ChatStatus;
  isStreaming: boolean;
  prompt: string;
  setPrompt: (value: string) => void;
  sendPrompt: (value?: string, attachments?: FileUIPart[]) => void;
  stop: AbstractChat<UIMessage>['stop'];
  initialSuggestions: readonly string[];
  suggestionsVisible: boolean;
  setSuggestionsVisible: (visible: boolean) => void;
};

/** Minimal host protocol consumed by the harness chat runtime. Subscription reconnects after its last delivered sequence. */
export type HarnessRunClient = {
  snapshot(conversationId: string): Promise<HarnessConversationSnapshot>;
  history(afterSeq: number, conversationId: string): Promise<HarnessRunEvent[]>;
  subscribe(
    afterSeq: number,
    onEvent: (event: HarnessRunEvent) => void,
  ): () => void;
  startTurn(input: HarnessStartTurn): Promise<HarnessRun>;
  sendInput(input: {runId: string; text: string}): Promise<void>;
  cancel(runId: string): Promise<void>;
  resolveApproval(input: {
    approvalId: string;
    decision: 'approve' | 'deny';
  }): Promise<void>;
  fetchBlob(ref: string): Promise<string>;
};
/** Runtime for externally supervised work; browser unmount never cancels it. */
export type HarnessRunChatRuntime = Omit<LocalAgentChatRuntime, 'mode'> & {
  mode: 'harness-run';
  events: HarnessRunEvent[];
  pendingApprovals: HarnessApproval[];
  run?: HarnessRun;
  error?: string;
  queued: string;
  resolveApproval: (id: string, decision: 'approve' | 'deny') => Promise<void>;
  fetchBlob: HarnessRunClient['fetchBlob'];
};
