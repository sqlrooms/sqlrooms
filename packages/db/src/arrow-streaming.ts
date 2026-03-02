import * as arrow from 'apache-arrow';

/**
 * Decoded message from the bridge's framed binary stream protocol.
 */
export type FramedStreamMessage = {
  type: string;
  payload: Uint8Array;
  error?: string;
};

function concatUint8Arrays(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/**
 * Parse a stream of framed binary messages into typed payload events.
 *
 * Frame format:
 * - 4-byte big-endian header length
 * - UTF-8 JSON header (`type`, `payloadLength`, optional `error`)
 * - binary payload bytes
 */
export async function* parseFramedBinaryStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  textDecoder: TextDecoder = new TextDecoder(),
): AsyncGenerator<FramedStreamMessage> {
  let buffer: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  while (true) {
    const {done, value} = await reader.read();
    if (done) {
      return;
    }
    buffer = concatUint8Arrays(buffer, value ?? new Uint8Array(0));
    while (buffer.length >= 4) {
      const headerLen = new DataView(
        buffer.buffer,
        buffer.byteOffset,
        4,
      ).getUint32(0, false);
      if (buffer.length < 4 + headerLen) {
        break;
      }
      const headerBytes = buffer.slice(4, 4 + headerLen);
      const header = JSON.parse(textDecoder.decode(headerBytes)) as {
        type?: string;
        payloadLength?: number;
        error?: string;
      };
      const payloadLength =
        typeof header.payloadLength === 'number' ? header.payloadLength : 0;
      const frameLen = 4 + headerLen + payloadLength;
      if (buffer.length < frameLen) {
        break;
      }
      const payload = buffer.slice(4 + headerLen, frameLen);
      yield {type: header.type || 'unknown', payload, error: header.error};
      buffer = buffer.slice(frameLen);
    }
  }
}

/**
 * Decode a single Arrow IPC payload chunk into an Arrow table.
 *
 * The chunk is expected to contain a complete IPC stream for one batch window.
 */
export async function decodeArrowIpcChunk(
  ipcChunk: Uint8Array,
): Promise<arrow.Table> {
  const reader = await arrow.RecordBatchReader.from(ipcChunk);
  const batches: arrow.RecordBatch[] = [];
  for await (const batch of reader) {
    batches.push(batch);
  }
  if (batches.length === 0) {
    return arrow.tableFromArrays({}) as unknown as arrow.Table;
  }
  return new arrow.Table(reader.schema, batches);
}
