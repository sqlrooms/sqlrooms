import {ProjectBuilderPanel} from '@sqlrooms/project-builder';
import {DEFAULT_PROJECT_TITLE} from '@sqlrooms/project';
import {cn, EditableText, Label, Textarea} from '@sqlrooms/ui';
import {useCallback} from 'react';
import {ProjectPanelTypes, useProjectStore} from '../store';

export default function ProjectDetailsPanel() {
  const title = useProjectStore((state) => state.config.title);
  const isReadOnly = useProjectStore((state) => state.project.isReadOnly);
  const setProjectTitle = useProjectStore(
    (state) => state.project.setProjectTitle,
  );
  const description = useProjectStore((state) => state.config.description);
  const setDescription = useProjectStore(
    (state) => state.project.setDescription,
  );

  const handleSetProjectTitle = useCallback(
    (title: string) => {
      const nextTitle = title.trim() || DEFAULT_PROJECT_TITLE;
      setProjectTitle(nextTitle);
      return nextTitle;
    },
    [setProjectTitle],
  );

  return (
    <ProjectBuilderPanel type={ProjectPanelTypes.enum['project-details']}>
      <div className="flex flex-grow flex-col gap-3">
        <div className="flex flex-grow flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-muted-foreground text-xs font-bold uppercase">
              Title
            </Label>
            <div className="w-full overflow-hidden text-sm">
              {isReadOnly ? (
                <span>{title}</span>
              ) : (
                <EditableText
                  isReadOnly={isReadOnly}
                  value={title}
                  placeholder={DEFAULT_PROJECT_TITLE}
                  onChange={handleSetProjectTitle}
                />
              )}
            </div>
          </div>

          <div className="flex flex-grow flex-col gap-1.5">
            <Label className="text-muted-foreground text-xs font-bold uppercase">
              Description
            </Label>
            {isReadOnly ? (
              <p className="text-xs">{description}</p>
            ) : (
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={cn(
                  'bg-secondary text-secondary-foreground flex-grow resize-none text-xs',
                  'placeholder:text-muted-foreground min-h-0 border-none',
                )}
                placeholder="A story behind this project, what it represents"
                maxLength={4096}
              />
            )}
          </div>
        </div>
      </div>
    </ProjectBuilderPanel>
  );
}
