import {
  DEFAULT_PROJECT_TITLE,
  ProjectPanelTypes,
} from '@sqlrooms/project-config';
import {EditableText, Label, Textarea} from '@sqlrooms/ui';
import {cn} from '@sqlrooms/ui/lib/utils';
import {useCallback} from 'react';
import {useBaseProjectStore} from '../../ProjectStateProvider';
import ProjectBuilderPanelHeader from '../ProjectBuilderPanelHeader';

export default function ProjectDetailsPanel() {
  const title = useBaseProjectStore((state) => state.projectConfig.title);
  const isReadOnly = useBaseProjectStore((state) => state.isReadOnly);
  const setProjectTitle = useBaseProjectStore((state) => state.setProjectTitle);
  const description = useBaseProjectStore(
    (state) => state.projectConfig.description,
  );
  const setDescription = useBaseProjectStore((state) => state.setDescription);

  const handleSetProjectTitle = useCallback(
    (title: string) => {
      const nextTitle = title.trim() || DEFAULT_PROJECT_TITLE;
      setProjectTitle(nextTitle);
      return nextTitle;
    },
    [setProjectTitle],
  );

  return (
    <div className="flex flex-col flex-grow gap-3">
      <ProjectBuilderPanelHeader panelKey={ProjectPanelTypes.PROJECT_DETAILS} />
      <div className="flex flex-col gap-3 flex-grow">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground font-bold uppercase">
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

        <div className="flex flex-col gap-1.5 flex-grow">
          <Label className="text-xs text-muted-foreground font-bold uppercase">
            Description
          </Label>
          {isReadOnly ? (
            <p className="text-xs">{description}</p>
          ) : (
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={cn(
                'flex-grow text-xs bg-secondary text-secondary-foreground resize-none',
                'placeholder:text-muted-foreground border-none min-h-0',
              )}
              placeholder="A story behind this project, what it represents"
              maxLength={4096}
            />
          )}
        </div>
      </div>
    </div>
  );
}
