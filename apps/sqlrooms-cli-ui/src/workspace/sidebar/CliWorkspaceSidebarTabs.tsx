import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useSidebar,
} from '@sqlrooms/ui';
import {useState} from 'react';
import {CliArtifactsSidebarSection} from './CliArtifactsSidebarSection';
import {CliChatsSidebarSection} from './CliChatsSidebarSection';

export function CliWorkspaceSidebarTabs() {
  const [activeTab, setActiveTab] = useState<'chats' | 'artifacts'>('chats');
  const {state} = useSidebar();

  if (state !== 'expanded') return null;

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as 'chats' | 'artifacts')}
      className="flex h-full min-h-0 min-w-0 flex-col"
    >
      <div className="mb-1 shrink-0 px-2">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="chats">Chats</TabsTrigger>
          <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="chats" className="mt-0 min-h-0 flex-1">
        <CliChatsSidebarSection />
      </TabsContent>
      <TabsContent value="artifacts" className="mt-0 min-h-0 flex-1">
        <CliArtifactsSidebarSection />
      </TabsContent>
    </Tabs>
  );
}
