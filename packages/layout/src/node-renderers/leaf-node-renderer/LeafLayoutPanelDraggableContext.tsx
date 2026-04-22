import {createContext, useContext} from 'react';
import {DraggableAttributes, useDraggable} from '@dnd-kit/core';

type SyntheticListenerMap = ReturnType<typeof useDraggable>['listeners'];

interface LeafLayoutPanelDraggableContextValue {
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap | undefined;
}

const LeafLayoutPanelDraggableContext =
  createContext<LeafLayoutPanelDraggableContextValue | null>(null);

export const LeafLayoutPanelDraggableProvider =
  LeafLayoutPanelDraggableContext.Provider;

export const useLeafLayoutPanelDraggable = () => {
  const context = useContext(LeafLayoutPanelDraggableContext);
  if (!context) {
    throw new Error(
      'useLeafLayoutPanelDraggable must be used within LeafLayoutPanelDraggableProvider',
    );
  }
  return context;
};
