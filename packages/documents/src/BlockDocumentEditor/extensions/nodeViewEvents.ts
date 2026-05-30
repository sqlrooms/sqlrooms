export const WIDGET_NODE_VIEW_SELECTOR =
  '[data-block-document-widget-node-view]';

export function isWidgetNodeViewEvent(event: Event) {
  return (
    event.target instanceof Element &&
    event.target.closest(WIDGET_NODE_VIEW_SELECTOR) !== null
  );
}

export function stopWidgetNodeViewEvent({event}: {event: Event}) {
  return isWidgetNodeViewEvent(event);
}
