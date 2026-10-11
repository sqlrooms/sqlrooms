import {cn, Spinner} from '@sqlrooms/ui';
import type {Ref} from 'react';
import {useStoreWithWebContainer} from '../WebContainerSlice';

export type BrowserViewProps = {
  className?: string;
  iframeRef?: Ref<HTMLIFrameElement>;
  onIframeLoad?: () => void;
};

export function BrowserView({
  className,
  iframeRef,
  onIframeLoad,
}: BrowserViewProps) {
  const serverStatus = useStoreWithWebContainer(
    (s) => s.webContainer.serverStatus,
  );
  return (
    <div className={cn('bg-background h-full w-full', className)}>
      {serverStatus.type === 'ready' && serverStatus.url ? (
        <iframe
          ref={iframeRef}
          className="h-full w-full overflow-auto bg-white"
          src={serverStatus.url}
          onLoad={onIframeLoad}
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
}
