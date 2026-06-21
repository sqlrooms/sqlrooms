import {
  closestCenter,
  Collision,
  CollisionDetection,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {createContext, FC, PropsWithChildren, useContext} from 'react';

const RoomDndContext = createContext(false);

function markPointerWithinCollisions(collisions: Collision[]) {
  return collisions.map((collision) => ({
    ...collision,
    data: {...collision.data, pointerWithin: true},
  }));
}

function markFallbackCollisions(collisions: Collision[]) {
  return collisions.map((collision) => ({
    ...collision,
    data: {...collision.data, pointerWithin: false},
  }));
}

function getCollisionPriority(
  collision: Collision,
  args: Parameters<CollisionDetection>[0],
) {
  const priority = args.droppableContainers.find(
    (container) => container.id === collision.id,
  )?.data.current?.roomDndPriority;
  return typeof priority === 'number' ? priority : 0;
}

const roomCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = markPointerWithinCollisions(pointerWithin(args));
  const collisions =
    pointerCollisions.length > 0
      ? pointerCollisions
      : markFallbackCollisions(closestCenter(args));

  if (args.active.data.current?.kind !== 'artifact') {
    return collisions;
  }

  return [...collisions].sort(
    (a, b) => getCollisionPriority(b, args) - getCollisionPriority(a, args),
  );
};

export const RoomDndProvider: FC<PropsWithChildren> = ({children}) => {
  const hasParentRoomDndProvider = useContext(RoomDndContext);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {distance: 6},
    }),
    useSensor(KeyboardSensor),
  );

  if (hasParentRoomDndProvider) {
    return <>{children}</>;
  }

  return (
    <RoomDndContext.Provider value>
      <DndContext sensors={sensors} collisionDetection={roomCollisionDetection}>
        {children}
      </DndContext>
    </RoomDndContext.Provider>
  );
};
