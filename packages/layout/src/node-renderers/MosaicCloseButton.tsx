import {Button} from '@sqlrooms/ui';
import {X} from 'lucide-react';
import {FC, useContext} from 'react';
import {MosaicContext, MosaicWindowContext} from 'react-mosaic-component';

export const MosaicCloseButton: FC = () => {
  const {mosaicWindowActions} = useContext(MosaicWindowContext);
  const {mosaicActions} = useContext(MosaicContext);

  const handleClose = () => {
    const path = mosaicWindowActions.getPath();
    mosaicActions.remove(path);
  };

  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={handleClose}
      aria-label="Close panel"
    >
      <X />
    </Button>
  );
};
