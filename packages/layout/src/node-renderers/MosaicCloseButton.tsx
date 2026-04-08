import {Button} from '@sqlrooms/ui';
import {X} from 'lucide-react';
import {FC, useCallback, useContext} from 'react';
import {MosaicContext, MosaicWindowContext} from 'react-mosaic-component';

export const MosaicCloseButton: FC = () => {
  const {mosaicWindowActions} = useContext(MosaicWindowContext);
  const {mosaicActions} = useContext(MosaicContext);

  const handleClose = useCallback(() => {
    const path = mosaicWindowActions.getPath();
    mosaicActions.remove(path);
  }, [mosaicWindowActions, mosaicActions]);

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={handleClose}
      className="text-muted-foreground hover:text-foreground hover:bg-foreground/10 h-6 w-6"
      aria-label="Close panel"
    >
      <X className="h-4 w-4" />
    </Button>
  );
};
