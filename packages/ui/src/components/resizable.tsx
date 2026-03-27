'use client';

import {GripVertical} from 'lucide-react';
import * as ResizablePrimitive from 'react-resizable-panels';

import {cn} from '../lib/utils';

type LegacyDirection = 'horizontal' | 'vertical';

type ResizablePanelGroupProps = Omit<
  React.ComponentProps<typeof ResizablePrimitive.Group>,
  'orientation'
> & {
  direction?: LegacyDirection;
  orientation?: LegacyDirection;
};

const ResizablePanelGroup = ({
  direction,
  orientation,
  className,
  ...props
}: ResizablePanelGroupProps) => (
  <ResizablePrimitive.Group
    orientation={orientation ?? direction}
    className={cn(
      'flex h-full w-full aria-orientation-vertical:flex-col',
      className,
    )}
    {...props}
  />
);

type ResizableSize = string | number | undefined;
type ResizablePanelProps = React.ComponentProps<
  typeof ResizablePrimitive.Panel
>;

const asLegacyPercent = (size: ResizableSize): ResizableSize =>
  typeof size === 'number' ? `${size}%` : size;

const ResizablePanel = ({
  defaultSize,
  minSize,
  maxSize,
  collapsedSize,
  ...props
}: ResizablePanelProps) => (
  <ResizablePrimitive.Panel
    defaultSize={asLegacyPercent(defaultSize)}
    minSize={asLegacyPercent(minSize)}
    maxSize={asLegacyPercent(maxSize)}
    collapsedSize={asLegacyPercent(collapsedSize)}
    {...props}
  />
);

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Separator> & {
  withHandle?: boolean;
}) => (
  <ResizablePrimitive.Separator
    className={cn(
      'bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden aria-orientation-vertical:h-px aria-orientation-vertical:w-full aria-orientation-vertical:after:left-0 aria-orientation-vertical:after:h-1 aria-orientation-vertical:after:w-full aria-orientation-vertical:after:translate-x-0 aria-orientation-vertical:after:-translate-y-1/2 [&[aria-orientation=vertical]>div]:rotate-90',
      className,
    )}
    {...props}
  >
    {withHandle && (
      <div className="bg-border z-20 flex h-4 w-3 items-center justify-center rounded-sm border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}
  </ResizablePrimitive.Separator>
);

export {ResizablePanelGroup, ResizablePanel, ResizableHandle};
