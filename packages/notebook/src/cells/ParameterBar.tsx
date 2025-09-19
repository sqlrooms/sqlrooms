import {Button} from '@sqlrooms/ui';
import {PinIcon, PinOff, PlusIcon} from 'lucide-react';
import {useState} from 'react';

export const ParameterBar = () => {
  const [isPinned, setIsPinned] = useState(false);
  return (
    <div className="relative flex h-[85px] flex-wrap gap-2 overflow-auto border-b p-2 text-xs">
      <div className="absolute right-2 top-2 items-center justify-center">
        <Button variant="ghost" className="h-6 w-6 p-2 text-gray-500">
          <PlusIcon size={14} strokeWidth={1.5} />
        </Button>
        {isPinned ? (
          <Button
            variant="ghost"
            onClick={() => setIsPinned(false)}
            className="h-6 w-6 p-2 text-gray-500"
          >
            <PinOff size={14} strokeWidth={1.5} />
          </Button>
        ) : (
          <Button
            variant="ghost"
            onClick={() => setIsPinned(true)}
            className="h-6 w-6 p-2 text-gray-500"
          >
            <PinIcon size={14} strokeWidth={1.5} />
          </Button>
        )}
      </div>
      <div>Parameter Bar Placeholder</div>
    </div>
  );
};
