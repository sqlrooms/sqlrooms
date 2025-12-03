import {Spinner} from '@sqlrooms/ui';
import {useRoomStore} from '../store/store';

export const BrowserView = () => {
  const serverStatus = useRoomStore((s) => s.webContainer.serverStatus);
  return (
    <div className="bg-background h-full w-full">
      {serverStatus.type === 'ready' ? (
        <iframe
          className="h-full w-full overflow-auto bg-white"
          src={serverStatus.url}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <div className="text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Spinner />
              <p>{serverStatus.type}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
