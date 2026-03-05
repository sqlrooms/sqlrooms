import * as arrow from 'apache-arrow';
import {
  decodeArrowIpcChunk,
  parseFramedBinaryStream,
} from '../src/arrow-streaming';

function encodeFrame(args: {
  type: string;
  payload?: Uint8Array;
  error?: string;
}): Uint8Array {
  const payload = args.payload ?? new Uint8Array(0);
  const header = {
    type: args.type,
    payloadLength: payload.length,
    ...(args.error ? {error: args.error} : {}),
  };
  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  const framed = new Uint8Array(4 + headerBytes.length + payload.length);
  new DataView(framed.buffer, framed.byteOffset, 4).setUint32(
    0,
    headerBytes.length,
    false,
  );
  framed.set(headerBytes, 4);
  framed.set(payload, 4 + headerBytes.length);
  return framed;
}

function readerFromChunks(
  chunks: Uint8Array[],
): ReadableStreamDefaultReader<Uint8Array> {
  let index = 0;
  return {
    read: async () => {
      if (index >= chunks.length) {
        return {done: true, value: undefined};
      }
      const value = chunks[index];
      index += 1;
      return {done: false, value};
    },
  } as ReadableStreamDefaultReader<Uint8Array>;
}

describe('arrow-streaming helpers', () => {
  it('parses framed binary messages across chunk boundaries', async () => {
    const payload1 = new Uint8Array([1, 2, 3]);
    const payload2 = new Uint8Array([4, 5]);
    const frame1 = encodeFrame({type: 'batch', payload: payload1});
    const frame2 = encodeFrame({type: 'end'});
    const combined = new Uint8Array(frame1.length + frame2.length);
    combined.set(frame1, 0);
    combined.set(frame2, frame1.length);

    const splitPoint = Math.floor(combined.length / 2);
    const chunks = [combined.slice(0, splitPoint), combined.slice(splitPoint)];
    const reader = readerFromChunks(chunks);

    const parsed: Array<{type: string; payload: Uint8Array; error?: string}> =
      [];
    for await (const message of parseFramedBinaryStream(reader)) {
      parsed.push(message);
    }

    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.type).toBe('batch');
    expect(Array.from(parsed[0]?.payload ?? [])).toEqual(Array.from(payload1));
    expect(parsed[1]?.type).toBe('end');
    expect(Array.from(parsed[1]?.payload ?? [])).toEqual([]);
    expect(Array.from(payload2)).toEqual([4, 5]);
  });

  it('decodes an Arrow IPC chunk into a table', async () => {
    const source = arrow.tableFromJSON([
      {id: 1, name: 'alice'},
      {id: 2, name: 'bob'},
    ]);
    const ipc = arrow.tableToIPC(source, 'stream');

    const decoded = await decodeArrowIpcChunk(ipc);
    expect(decoded.numRows).toBe(2);
    expect(decoded.getChild('id')?.get(0)).toBe(1);
    expect(decoded.getChild('name')?.get(1)).toBe('bob');
  });
});
