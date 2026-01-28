import {Chat} from '@sqlrooms/ai';
import {
  Button,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHandle,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@sqlrooms/ui';
import {SparklesIcon, XIcon} from 'lucide-react';
import {FC} from 'react';
import {useStoreWithCanvas} from './CanvasSlice';

export const CanvasAssistantDrawer: FC = () => {
  const isAssistantOpen = useStoreWithCanvas(
    (state) => state.canvas.isAssistantOpen,
  );
  const setAssistantOpen = useStoreWithCanvas(
    (state) => state.canvas.setAssistantOpen,
  );
  return (
    <Drawer
      direction="right"
      open={isAssistantOpen}
      onOpenChange={setAssistantOpen}
    >
      <DrawerTrigger asChild>
        <Button
          variant="default"
          className="absolute right-4 top-4 z-10 h-8 w-8 rounded-full"
        >
          <SparklesIcon className="h-4 w-4" />
        </Button>
      </DrawerTrigger>
      <DrawerContent
        className="border-none bg-transparent p-4 outline-none"
        style={{
          width: 500,
          maxWidth: '50%',
        }}
        data-vaul-drawer-direction="right"
        overlayClassName="bg-transparent"
      >
        <div className="border-border bg-background relative mx-auto flex h-full w-full flex-col gap-0 overflow-hidden rounded-md border">
          <Chat>
            <DrawerHeader>
              <DrawerTitle>Assistant</DrawerTitle>
              <DrawerClose asChild className="absolute right-2 top-2">
                <Button variant="ghost" size="xs">
                  <XIcon className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </DrawerHeader>
            <Chat.Messages className="flex-grow overflow-auto px-4" />
            <DrawerFooter>
              <Chat.Composer placeholder="What would you like to do?" />
            </DrawerFooter>
          </Chat>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
