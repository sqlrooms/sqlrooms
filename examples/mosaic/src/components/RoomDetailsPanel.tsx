import {DEFAULT_ROOM_TITLE, RoomPanel} from '@sqlrooms/room-shell';
import {cn, EditableText, Label, Textarea} from '@sqlrooms/ui';
import {useCallback} from 'react';
import {RoomPanelTypes, useRoomStore} from '../store';

export default function RoomDetailsPanel() {
  const title = useRoomStore((state) => state.room.config.title);
  const setRoomTitle = useRoomStore((state) => state.room.setRoomTitle);
  const description = useRoomStore((state) => state.room.config.description);
  const setDescription = useRoomStore((state) => state.room.setDescription);

  const handleSetRoomTitle = useCallback(
    (title: string) => {
      const nextTitle = title.trim() || 'Untitled room';
      setRoomTitle(nextTitle);
      return nextTitle;
    },
    [setRoomTitle],
  );

  return (
    <RoomPanel type={RoomPanelTypes.enum['room-details']}>
      <div className="flex flex-grow flex-col gap-3">
        <div className="flex flex-grow flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-muted-foreground text-xs font-bold uppercase">
              Title
            </Label>
            <div className="w-full overflow-hidden text-sm">
              <EditableText
                value={title}
                placeholder={DEFAULT_ROOM_TITLE}
                onChange={handleSetRoomTitle}
              />
            </div>
          </div>

          <div className="flex flex-grow flex-col gap-1.5">
            <Label className="text-muted-foreground text-xs font-bold uppercase">
              Description
            </Label>

            <Textarea
              value={description || ''}
              onChange={(e) => setDescription(e.target.value)}
              className={cn(
                'bg-secondary text-secondary-foreground flex-grow resize-none text-xs',
                'placeholder:text-muted-foreground min-h-0 border-none',
              )}
              placeholder="A story behind this room, what it represents"
              maxLength={4096}
            />
          </div>
        </div>
      </div>
    </RoomPanel>
  );
}
