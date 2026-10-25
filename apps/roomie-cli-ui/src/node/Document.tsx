import {useRef, useState} from 'react';
import {
  BlockDocumentEditor,
  BlockDocumentChartRendererProvider,
  BlockDocumentStatefulBlockRendererProvider,
  BlockDocumentContent,
  type DocumentAsset,
  type BlockDocumentStatefulBlockRendererProps,
} from '@sqlrooms/documents';
import {
  ChartBlockRenderer,
  DataTableBlockRenderer,
  MosaicDashboard,
} from '@sqlrooms/mosaic';
import {HtmlAppBlock} from '@sqlrooms/app-runtime';
import {Button} from '@sqlrooms/ui';
import {hostRequest} from './client';

function Dashboard({blockInstanceId}: BlockDocumentStatefulBlockRendererProps) {
  return blockInstanceId ? (
    <MosaicDashboard dashboardId={blockInstanceId} readOnly />
  ) : null;
}
function Html({blockInstanceId}: BlockDocumentStatefulBlockRendererProps) {
  return (
    <HtmlAppBlock
      readOnly
      blockId={blockInstanceId}
      className="h-full min-h-80"
    />
  );
}
const renderers = {
  'data-table': DataTableBlockRenderer,
  dashboard: Dashboard,
  'html-app': Html,
};
type Draft = {
  revision: number;
  content: BlockDocumentContent;
  operationId: string;
  title?: string;
  pending?: boolean;
};

/** Local draft editor. Only a revision-checked shared command publishes changes. */
export function NodeDocument({
  id,
  workspaceId,
  revision,
  title,
  content,
  assets,
  onCommitted,
}: {
  id: string;
  workspaceId: string;
  revision: number;
  title?: string;
  content: BlockDocumentContent;
  assets?: Record<string, DocumentAsset>;
  onCommitted: (
    content: unknown,
    revisions: Record<string, number>,
    sequence: number,
  ) => void;
}) {
  const prefix = `roomie-draft:${workspaceId}:${id}:`;
  const pointer = prefix + 'active';
  const [key] = useState(() => prefix + crypto.randomUUID());
  const [sourceKey, setSourceKey] = useState(() =>
    sessionStorage.getItem(pointer),
  );
  function readDraft(slot: string | null): Draft | undefined {
    try {
      const value = slot && localStorage.getItem(slot);
      if (!value) return undefined;
      const draft = JSON.parse(value);
      BlockDocumentContent.parse(draft.content);
      if (
        !Number.isSafeInteger(draft.revision) ||
        typeof draft.operationId !== 'string'
      )
        return undefined;
      return draft;
    } catch {
      return undefined;
    }
  }
  const [draft, setDraft] = useState<Draft | undefined>(() =>
    readDraft(sourceKey),
  );
  const recoverable = Object.keys(localStorage).filter(
    (slot) => slot.startsWith(prefix) && slot !== key && readDraft(slot),
  );
  const draftRef = useRef(draft);
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(draft?.pending ?? false);
  const conflict = draft !== undefined && draft.revision !== revision;
  function persist(value: Draft | undefined) {
    try {
      if (value) {
        localStorage.setItem(key, JSON.stringify(value));
        sessionStorage.setItem(pointer, key);
      } else {
        localStorage.removeItem(key);

        sessionStorage.removeItem(pointer);
        setSourceKey(null);
      }
      setStorageError('');
    } catch {
      setStorageError(
        'Could not store this draft locally. Keep this tab open and save or copy your edits.',
      );
    }
    draftRef.current = value;
    setDraft(value);
  }
  async function save() {
    if (!draft) return;
    persist({...draft, pending: true});
    setSaving(true);
    setError('');
    try {
      await hostRequest('/api/commands', {
        commandId: 'block-document.set-content',
        input: {
          artifactId: id,
          content: draft.content,
          title: draft.title,
        },
        commit: {
          operationId: draft.operationId,
          artifactId: id,
          expectedRevision: draft.revision,
        },
      });
      // Keep the draft until content delivery catches up by fetching committed
      // content before clearing it. The subscription may arrive first or later.
      const current = await hostRequest('/api/content');
      onCommitted(current.content, current.revisions, current.sequence);
      persist(undefined);
      setUncertain(false);
    } catch (failure) {
      const value = failure as Error & {code?: string; definitive?: boolean};
      setUncertain(!value.definitive);
      persist({...draft, pending: !value.definitive});
      setError(value.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b p-2">
        {!draft ? (
          <Button
            size="sm"
            onClick={() =>
              persist({
                revision,
                content: structuredClone(content),
                title,
                operationId: crypto.randomUUID(),
              })
            }
          >
            Edit document
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              disabled={saving || (conflict && !uncertain)}
              onClick={() => void save()}
            >
              {uncertain
                ? 'Retry same save'
                : saving
                  ? 'Saving…'
                  : 'Save draft'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={saving || uncertain}
              onClick={() => {
                persist(undefined);
                setError('');
              }}
            >
              Discard draft
            </Button>
            <span className="text-xs">
              Local draft from revision {draft.revision}
            </span>
          </>
        )}
      </div>
      {!draft &&
        recoverable.map((slot) => (
          <div key={slot} className="flex gap-2 p-2">
            <Button
              variant="outline"
              onClick={() => {
                setSourceKey(slot);
                const recovered = readDraft(slot);
                persist(recovered);
                setUncertain(recovered?.pending ?? false);
                setError('');
              }}
            >
              Recover local draft: {readDraft(slot)?.title ?? id} (revision{' '}
              {readDraft(slot)?.revision})
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                localStorage.removeItem(slot);
                setSourceKey(null);
                setError('Stored draft discarded.');
              }}
            >
              Discard stored copy
            </Button>
          </div>
        ))}
      {conflict && (
        <div role="alert" className="border p-3">
          The committed document is now revision {revision}. Your draft is
          preserved. Review the current content below, then copy your edits
          before discarding and starting a new draft.
          <details>
            <summary>Current committed content</summary>
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(content, null, 2)}
            </pre>
          </details>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {storageError && <p role="alert">{storageError}</p>}
      <BlockDocumentChartRendererProvider renderer={ChartBlockRenderer}>
        <BlockDocumentStatefulBlockRendererProvider renderers={renderers}>
          <BlockDocumentEditor
            key={`${id}:${draft ? 'draft' : revision}`}
            documentId={id}
            assets={assets}
            title={draft?.title ?? title}
            onTitleChange={(next) => {
              if (draftRef.current && !saving && !uncertain)
                persist({
                  ...draftRef.current,
                  title: next,
                  operationId: crypto.randomUUID(),
                });
            }}
            value={draft?.content ?? content}
            readOnly={!draft || saving || uncertain}
            onChange={(next) => {
              if (draftRef.current && !saving && !uncertain)
                persist({
                  ...draftRef.current,
                  content: next,
                  operationId: crypto.randomUUID(),
                });
            }}
          >
            {draft && <BlockDocumentEditor.Toolbar />}
            <BlockDocumentEditor.Content />
          </BlockDocumentEditor>
        </BlockDocumentStatefulBlockRendererProvider>
      </BlockDocumentChartRendererProvider>
    </>
  );
}
