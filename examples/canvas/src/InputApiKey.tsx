import {cn, Input} from '@sqlrooms/ui';
import {KeyIcon} from 'lucide-react';
import {useRoomStore} from './store';
import {FC} from 'react';

export const InputApiKey: FC<{className?: string}> = ({className}) => {
  const apiKey = useRoomStore((s) => s.apiKey);
  const setApiKey = useRoomStore((s) => s.setApiKey);
  return (
    <div
      className={cn(
        'bg-muted relative flex items-center rounded-md',
        className,
      )}
    >
      <KeyIcon className="absolute left-2 h-4 w-4" />
      <Input
        className="pl-8 text-xs placeholder:text-xs"
        type="password"
        placeholder={`OpenAI API key`}
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
      />
    </div>
  );
};
