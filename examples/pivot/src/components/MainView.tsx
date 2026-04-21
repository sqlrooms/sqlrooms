import {Button, cn} from '@sqlrooms/ui';
import {PivotView} from '@sqlrooms/pivot';
import {useRoomStore} from '../store';

export const MainView = () => {
  const pivotConfig = useRoomStore((state) => state.pivot.config);
  const addPivot = useRoomStore((state) => state.pivot.addPivot);
  const setCurrentPivot = useRoomStore((state) => state.pivot.setCurrentPivot);
  const removePivot = useRoomStore((state) => state.pivot.removePivot);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b px-4 pt-3">
        <div className="flex flex-wrap items-center gap-2 pb-3">
          {pivotConfig.pivotOrder.map((pivotId) => {
            const pivot = pivotConfig.pivots[pivotId];
            if (!pivot) return null;
            const isActive = pivotConfig.currentPivotId === pivotId;
            return (
              <div key={pivotId} className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant={isActive ? 'default' : 'outline'}
                  className={cn('h-8', !isActive && 'text-muted-foreground')}
                  onClick={() => setCurrentPivot(pivotId)}
                >
                  {pivot.title}
                </Button>
                {pivotConfig.pivotOrder.length > 1 ? (
                  <Button
                    size="xs"
                    variant="ghost"
                    className="h-8 px-2"
                    onClick={() => removePivot(pivotId)}
                  >
                    x
                  </Button>
                ) : null}
              </div>
            );
          })}
          <Button size="sm" variant="secondary" onClick={() => addPivot()}>
            Add pivot
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <PivotView />
      </div>
    </div>
  );
};
