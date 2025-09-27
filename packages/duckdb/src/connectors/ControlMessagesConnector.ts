/**
 * Connector interface that supports control messages and notification listeners.
 * Used by higher-level features (e.g. CRDT sync) to request state or push updates.
 */
export interface ControlMessagesConnector {
  sendControlMessage: (message: any) => void;
  addNotificationListener: (fn: (payload: any) => void) => void;
}

export function isControlMessagesConnector(
  connector: unknown,
): connector is ControlMessagesConnector {
  return (
    connector != null &&
    typeof (connector as any).sendControlMessage === 'function' &&
    typeof (connector as any).addNotificationListener === 'function'
  );
}
