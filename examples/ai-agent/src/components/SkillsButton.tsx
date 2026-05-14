import {
  createSkillAuthoringAgent,
  createSkillDraftStore,
  SkillAuthoringPanel,
  type SaveSkillCallback,
  type SkillAuthoringContext,
  type SkillDraftStore,
} from '@sqlrooms/ai';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@sqlrooms/ui';
import {SparklesIcon} from 'lucide-react';
import React, {useCallback, useMemo, useState} from 'react';
import {getModel} from '../skills/getModel';
import {roomStore, skillStorage} from '../store';

const AUTHORING_CONTEXT: SkillAuthoringContext = {
  services: ['querySQL'],
  tools: ['querySQL'],
  permissions: [],
  forbiddenIdentifiers: [],
  defaultRootId: 'default',
};

/**
 * Header button that opens the skills authoring wizard in a dialog.
 * The authoring agent and draft store are recreated per-open so each
 * session starts with a clean slate.
 */
export const SkillsButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <Button
        variant="outline"
        className="hover:bg-accent h-8 gap-1.5 text-xs"
        onClick={() => setOpen(true)}
        title="Create a skill with AI"
      >
        <SparklesIcon className="h-3.5 w-3.5" />
        <span>New skill</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[80vh] max-h-180 w-[min(1040px,95vw)] flex-col gap-0 p-0 sm:max-w-none">
          <DialogHeader className="border-border border-b px-4 py-3">
            <DialogTitle>New skill with AI</DialogTitle>
            <DialogDescription>
              Describe the skill you want. The agent drafts the manifest and
              instructions; the preview on the right updates live.
            </DialogDescription>
          </DialogHeader>
          {open && <AuthoringBody onDone={close} />}
        </DialogContent>
      </Dialog>
    </>
  );
};

const AuthoringBody: React.FC<{onDone: () => void}> = ({onDone}) => {
  // Fresh store + agent per mount — component is unmounted on close, so each
  // open naturally starts with a clean slate.
  const draftStore: SkillDraftStore = useMemo(
    () => createSkillDraftStore(),
    [],
  );

  const handleSave = useCallback<SaveSkillCallback>(
    async (draft, rootId) => {
      const targetRoot = rootId ?? AUTHORING_CONTEXT.defaultRootId ?? 'default';
      // Derive a kebab-case id from the name, resolving any collision by
      // appending `-2`, `-3`, ...
      const baseId = slugify(draft.name);
      let candidateId = baseId;
      let counter = 2;

      while (true) {
        const existing = await skillStorage.resolveSkillId(candidateId);
        if (!existing) break;
        candidateId = `${baseId}-${counter++}`;
      }
      const ref = await skillStorage.writeSkill(targetRoot, candidateId, {
        manifest: {
          id: candidateId,
          version: '0.1.0',
          name: draft.name,
          description: draft.description,
          ...(draft.author ? {author: draft.author} : {}),
        },
        instructions: draft.instructions,
      });
      // Close the dialog on success — the status pill never shows "saved".
      setTimeout(onDone, 0);
      return ref;
    },
    [onDone],
  );

  const agent = useMemo(
    () =>
      createSkillAuthoringAgent({
        model: getModel(roomStore),
        context: AUTHORING_CONTEXT,
        draftStore,
        onSave: handleSave,
      }),
    [draftStore, handleSave],
  );

  return (
    <SkillAuthoringPanel
      agent={agent}
      draftStore={draftStore}
      onCancel={onDone}
      className="min-h-0 flex-1 overflow-hidden"
      initialSuggestions={[
        'Build a skill that checks a column for null values.',
        'Build a skill that reports the row count of each table.',
      ]}
    />
  );
};

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'untitled-skill';
}
