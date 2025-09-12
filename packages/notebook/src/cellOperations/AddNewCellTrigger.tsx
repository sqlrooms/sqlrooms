import {Button, Separator} from '@sqlrooms/ui';
import {PlusIcon} from 'lucide-react';

import {IconWithTooltip} from './IconWithTooltip';

export const TriggerButton: React.FC = () => (
  <Button size="xs">Add new cell</Button>
);

export const TriggerSeparator: React.FC = () => (
  <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 py-1 opacity-60 transition-opacity hover:opacity-100">
    <Separator className="w-full bg-gray-500" />
    <IconWithTooltip
      className="px-2"
      icon={<PlusIcon strokeWidth={1} size="16px" />}
      title="Add new cell"
    />
    <Separator className="w-full bg-gray-500" />
  </div>
);
