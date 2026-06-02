import {
  Chat,
  getAiRunContextPrimaryItem,
  useStoreWithAi,
  type AiSliceState,
} from '@sqlrooms/ai';
import {useRoomStoreApi, type BaseRoomStoreState} from '@sqlrooms/room-store';
import {Button} from '@sqlrooms/ui';
import {ArrowLeft, Bot, MessageSquarePlus, Sparkles} from 'lucide-react';
import {useEffect, useMemo, useRef, useState} from 'react';

type AssistantPanelProps = {
  worksheetId?: string;
  worksheetTitle?: string;
};

const WORKSHEET_CONTEXT_KIND = 'worksheet';
const OPENROUTER_MODELS = [
  {
    provider: 'openrouter',
    label: 'GPT-4o mini',
    value: 'openai/gpt-4o-mini',
  },
];
type AssistantRoomState = BaseRoomStoreState & AiSliceState;

export function AssistantPanel({
  worksheetId,
  worksheetTitle,
}: AssistantPanelProps) {
  const [mode, setMode] = useState<'list' | 'session'>('session');
  const previousWorksheetIdRef = useRef(worksheetId);
  const roomStore = useRoomStoreApi<AssistantRoomState>();
  const currentSession = useStoreWithAi((state) =>
    state.ai.getCurrentSession(),
  );
  const sessions = useStoreWithAi((state) => state.ai.config.sessions);
  const createSession = useStoreWithAi((state) => state.ai.createSession);
  const switchSession = useStoreWithAi((state) => state.ai.switchSession);
  const setSessionRunContext = useStoreWithAi(
    (state) => state.ai.setSessionRunContext,
  );

  const worksheetContextItem = useMemo(
    () =>
      worksheetId
        ? {
            kind: WORKSHEET_CONTEXT_KIND,
            id: worksheetId,
            title: worksheetTitle ?? 'Worksheet',
            type: 'worksheet',
          }
        : undefined,
    [worksheetId, worksheetTitle],
  );
  const worksheetSessions = useMemo(
    () =>
      sessions
        .filter((session) => isWorksheetSession(session, worksheetId))
        .slice()
        .sort(
          (left, right) => getSessionRecency(right) - getSessionRecency(left),
        ),
    [sessions, worksheetId],
  );
  const currentSessionBelongsToWorksheet = Boolean(
    currentSession && isWorksheetSession(currentSession, worksheetId),
  );
  const activeSessionId =
    mode === 'session' && currentSessionBelongsToWorksheet
      ? currentSession?.id
      : null;

  useEffect(() => {
    if (previousWorksheetIdRef.current === worksheetId) return;

    previousWorksheetIdRef.current = worksheetId;
    setMode('list');
  }, [worksheetId]);

  const startSession = () => {
    if (!worksheetContextItem) return;
    createSession('New session', 'openrouter', OPENROUTER_MODELS[0].value);
    const sessionId = roomStore.getState().ai.getCurrentSession()?.id;
    if (!sessionId) return;
    setSessionRunContext(sessionId, {
      items: [worksheetContextItem],
      primaryItemId: worksheetContextItem.id,
      primaryItemKind: worksheetContextItem.kind,
      capturedAt: Date.now(),
    });
    setMode('session');
  };

  const openSession = (sessionId: string) => {
    switchSession(sessionId);
    setMode('session');
  };

  return (
    <aside className="assistant-panel">
      <Chat.Root>
        <div className="assistant-header">
          <div className="assistant-title">
            <Bot className="size-4" aria-hidden />
            Assistant
          </div>
          <div className="assistant-header-actions">
            {activeSessionId ? (
              <Button
                variant="ghost"
                size="icon"
                className="topbar-icon"
                type="button"
                onClick={() => setMode('list')}
              >
                <ArrowLeft className="size-4" aria-hidden />
                <span className="sr-only">Show assistant sessions</span>
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="topbar-icon"
              type="button"
              onClick={startSession}
              disabled={!worksheetContextItem}
            >
              <Sparkles className="size-4" aria-hidden />
              <span className="sr-only">New assistant session</span>
            </Button>
          </div>
        </div>

        {activeSessionId ? (
          <AssistantSessionView
            sessionId={activeSessionId}
            worksheetTitle={worksheetTitle}
          />
        ) : (
          <AssistantSessionList
            sessions={worksheetSessions}
            worksheetTitle={worksheetTitle}
            onOpenSession={openSession}
            onStartSession={startSession}
            canStart={Boolean(worksheetContextItem)}
          />
        )}
      </Chat.Root>
    </aside>
  );
}

function AssistantSessionView({
  sessionId,
  worksheetTitle,
}: {
  sessionId: string;
  worksheetTitle?: string;
}) {
  return (
    <div className="assistant-chat">
      <div className="assistant-chat-body">
        <Chat.Messages key={sessionId} />
      </div>
      <Chat.PromptSuggestions>
        <Chat.PromptSuggestions.Item text="Summarize what this worksheet should analyze." />
        <Chat.PromptSuggestions.Item text="Suggest a query for the selected tables." />
        <Chat.PromptSuggestions.Item text="What chart would be useful here?" />
      </Chat.PromptSuggestions>
      <Chat.Composer
        className="assistant-chat-composer"
        placeholder={`Ask about ${worksheetTitle ?? 'this worksheet'}`}
      >
        <Chat.ModelSelector models={OPENROUTER_MODELS} />
      </Chat.Composer>
    </div>
  );
}

function AssistantSessionList({
  sessions,
  worksheetTitle,
  onOpenSession,
  onStartSession,
  canStart,
}: {
  sessions: Array<{
    id: string;
    name: string;
    lastOpenedAt?: number;
    createdAt?: Date;
  }>;
  worksheetTitle?: string;
  onOpenSession: (sessionId: string) => void;
  onStartSession: () => void;
  canStart: boolean;
}) {
  return (
    <div className="assistant-session-list">
      <Button
        className="assistant-new-session"
        type="button"
        variant="secondary"
        onClick={onStartSession}
        disabled={!canStart}
      >
        <MessageSquarePlus className="size-4" aria-hidden />
        Start new session
      </Button>

      <div className="assistant-session-items">
        {sessions.length ? (
          sessions.map((session) => (
            <button
              className="assistant-session-item"
              key={session.id}
              type="button"
              onClick={() => onOpenSession(session.id)}
            >
              <span className="assistant-session-name">{session.name}</span>
              <span className="assistant-session-age">
                {formatRelativeAge(getSessionRecency(session))}
              </span>
            </button>
          ))
        ) : (
          <div className="assistant-empty-state">
            No sessions for {worksheetTitle ?? 'this worksheet'}.
          </div>
        )}
      </div>
    </div>
  );
}

function isWorksheetSession(
  session: {runContext?: unknown},
  worksheetId: string | undefined,
) {
  if (!worksheetId) return false;
  const item = getAiRunContextPrimaryItem(session.runContext);
  return item?.kind === WORKSHEET_CONTEXT_KIND && item.id === worksheetId;
}

function getSessionRecency(session: {
  lastOpenedAt?: number;
  createdAt?: Date | string;
}) {
  if (typeof session.lastOpenedAt === 'number') return session.lastOpenedAt;
  const createdAt = session.createdAt
    ? new Date(session.createdAt).getTime()
    : undefined;
  return Number.isFinite(createdAt) ? createdAt! : 0;
}

function formatRelativeAge(timestamp: number) {
  if (!timestamp) return '';
  const diffMs = Math.max(0, Date.now() - timestamp);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return 'now';
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h`;
  return `${Math.floor(diffMs / day)}d`;
}
