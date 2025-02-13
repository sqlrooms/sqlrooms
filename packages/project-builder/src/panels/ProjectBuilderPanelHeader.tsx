import {PinIcon, PinOffIcon, XIcon} from 'lucide-react';
import {FC, useMemo} from 'react';
import {useBaseProjectStore} from '../ProjectStateProvider';
import {PanelHeaderButton} from './PanelHeaderButton';

const ProjectBuilderPanelHeader: FC<{
  panelKey: string;
  showHeader?: boolean;
  children?: React.ReactNode;
}> = (props) => {
  const {showHeader = true, panelKey: type, children} = props;
  const panels = useBaseProjectStore((state) => state.project.panels);
  const {icon: Icon, title} = panels[type] ?? {};
  const togglePanel = useBaseProjectStore((state) => state.project.togglePanel);
  const togglePanelPin = useBaseProjectStore(
    (state) => state.project.togglePanelPin,
  );
  const pinnedPanels = useBaseProjectStore(
    (state) => state.project.config.layout.pinned,
  );
  const isPinned = useMemo(
    () => pinnedPanels?.includes(type),
    [pinnedPanels, type],
  );

  return (
    <div className="flex">
      <div className="flex flex-row w-full items-center gap-2">
        {showHeader && (
          <>
            {Icon ? <Icon className="w-4 h-4" /> : null}
            <h2 className="text-xs uppercase text-muted-foreground font-semibold">
              {title}
            </h2>
          </>
        )}
        {children}
      </div>
      <div className="flex gap-0 bg-secondary/50">
        <PanelHeaderButton
          isPinned={isPinned}
          icon={
            isPinned ? (
              <PinIcon className="w-[18px]" />
            ) : (
              <PinOffIcon className="w-[18px]" />
            )
          }
          onClick={() => togglePanelPin(type)}
          label="Pin panel"
        />
        <PanelHeaderButton
          icon={<XIcon className="w-[18px]" />}
          onClick={() => togglePanel(type)}
          label={`Close panel "${title}"`}
        />
      </div>
    </div>
  );
};

export {ProjectBuilderPanelHeader};
