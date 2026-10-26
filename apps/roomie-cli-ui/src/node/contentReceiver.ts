/** Apply committed snapshots in durable sequence order across HTTP and WebSocket delivery. */
export function createContentReceiver(
  initialSequence: number,
  apply: (content: unknown, revisions: Record<string, number>) => void,
) {
  let sequence = initialSequence;
  return (
    content: unknown,
    revisions: Record<string, number>,
    next: number,
  ) => {
    if (!Number.isSafeInteger(next) || next <= sequence) return;
    apply(content, revisions);
    sequence = next;
  };
}
