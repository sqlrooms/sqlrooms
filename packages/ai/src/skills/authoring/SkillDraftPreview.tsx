import {cn, ScrollArea, ScrollBar} from '@sqlrooms/ui';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {useStore} from 'zustand';
import type {SkillDraftStore} from './createSkillDraftStore';

export type SkillDraftPreviewProps = {
  draftStore: SkillDraftStore;
  className?: string;
};

/**
 * Live preview of the authoring draft. Subscribes to the draft store and
 * renders the manifest fields (name, description, author) plus the
 * instructions markdown.
 */
export const SkillDraftPreview: React.FC<SkillDraftPreviewProps> = ({
  draftStore,
  className,
}) => {
  const name = useStore(draftStore, (s) => s.name);
  const description = useStore(draftStore, (s) => s.description);
  const author = useStore(draftStore, (s) => s.author);
  const instructions = useStore(draftStore, (s) => s.instructions);

  const hasManifestContent = Boolean(name || description);
  const hasInstructions = instructions.trim().length > 0;

  return (
    <div className={cn('flex h-full w-full flex-col', className)}>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-4">
          {hasManifestContent ? (
            <ManifestCard
              name={name}
              description={description}
              author={author}
            />
          ) : (
            <div className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
              The agent will draft manifest details here as you chat.
            </div>
          )}

          {hasInstructions ? (
            <div className="bg-muted/20 rounded-md p-3">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {instructions}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
              The agent hasn&apos;t drafted instructions yet — describe your
              skill in the chat.
            </div>
          )}
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </div>
  );
};

const ManifestCard: React.FC<{
  name: string;
  description: string;
  author: string;
}> = ({name, description, author}) => {
  return (
    <div className="bg-muted/40 flex flex-col gap-2 rounded-md p-4 transition-opacity duration-300">
      <div className="text-base leading-tight font-semibold">
        {name || 'Untitled skill'}
      </div>
      {description && (
        <div className="text-muted-foreground text-sm leading-relaxed">
          {description}
        </div>
      )}
      {author && (
        <div className="text-muted-foreground/80 text-xs">by {author}</div>
      )}
    </div>
  );
};
