import {useEffect} from 'react';
import {useRoomStore} from '../store/store';

export const BrowserView = () => {
  const initialize = useRoomStore((s) => s.wc.initialize);
  useEffect(() => {
    // Remove once RoomStore calls initialize() instead of RoomShellStore
    initialize();
  }, [initialize]);
  const serverStatus = useRoomStore((s) => s.wc.serverStatus);
  return (
    <div className="bg-background h-full w-full">
      {serverStatus.type === 'ready' ? (
        <iframe
          className="h-full w-full overflow-auto bg-white"
          src={serverStatus.url}
        />
      ) : null}
    </div>
  );
};
