import {AnalysisResultsContainer, QueryControls} from '@sqlrooms/ai';
import {
  Button,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@sqlrooms/ui';
import {SparklesIcon, XIcon} from 'lucide-react';
import {FC} from 'react';

export const CanvasAssistantDrawer: FC = () => {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button
          variant="default"
          className="absolute right-4 top-4 z-10 h-8 w-8 rounded-full"
        >
          <SparklesIcon className="h-4 w-4" />
        </Button>
      </DrawerTrigger>
      <DrawerContent
        data-vaul-drawer-direction="right"
        className="border-none bg-transparent p-4"
        overlayClassName="bg-transparent"
      >
        <div className="border-border bg-background relative mx-auto flex h-full w-full max-w-sm flex-col gap-0 overflow-hidden rounded-md border">
          <DrawerHeader>
            <DrawerTitle>Assistant</DrawerTitle>
            {/* <DrawerDescription>Canvas assistant</DrawerDescription> */}
            <DrawerClose asChild className="absolute right-2 top-2">
              <Button variant="ghost" size="xs">
                <XIcon className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </DrawerHeader>
          <AnalysisResultsContainer className="flex-grow overflow-auto px-4" />
          <DrawerFooter>
            <QueryControls placeholder="What would you like to do?" />
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
