import {
  RoomPanelComponent,
  TabsLayout,
  useTabsLayoutContext,
} from '@sqlrooms/layout';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  TabStrip,
} from '@sqlrooms/ui';
import {SparklesIcon} from 'lucide-react';
import {useCallback} from 'react';
import {ARTIFACT_TYPES, ArtifactTypeInfo} from '../artifactTypes';
import {useRoomStore} from '../store';

export const ArtifactsContainerPanel: RoomPanelComponent = () => {
  const executeCommand = useRoomStore((s) => s.commands.executeCommand);
  const {node} = useTabsLayoutContext();
  const addTab = useRoomStore((s) => s.layout.addTab);
  const toggleCollapsed = useRoomStore((s) => s.layout.toggleCollapsed);
  const isAssistantCollapsed = useRoomStore((s) =>
    s.layout.isCollapsed('assistant'),
  );

  const handleAddSheet = useCallback(async (info: ArtifactTypeInfo) => {
    const result = await executeCommand(info.addCommand, {
      title: `New ${info.title}`,
    });
    if (result?.success) {
      const {sheetId} = result.data as {sheetId: string};
      addTab(node.id, sheetId);
    }
  }, []);

  return (
    <>
      <TabsLayout.TabStrip closeable={true} preventCloseLastTab={false}>
        <TabsLayout.SearchDropdown />
        <TabsLayout.Tabs />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <TabStrip.NewButton aria-label="Add chart to dashboard" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {Object.values(ARTIFACT_TYPES).map((type) => (
              <DropdownMenuItem
                key={type.title}
                onClick={() => handleAddSheet(type)}
              >
                <type.icon /> {`New ${type.title}`}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex-1" />
        {isAssistantCollapsed ? (
          <TabStrip.Button
            className="w-auto text-xs uppercase"
            onClick={() => toggleCollapsed('assistant')}
          >
            <SparklesIcon className="h-4 w-4" /> AI
          </TabStrip.Button>
        ) : null}
      </TabsLayout.TabStrip>
      <TabsLayout.TabContent />
    </>
  );
};
