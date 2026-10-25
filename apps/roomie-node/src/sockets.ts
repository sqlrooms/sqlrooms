import type {Server} from 'node:http';
import {WebSocketServer, WebSocket} from 'ws';
import {arrowTableToJson} from '@sqlrooms/duckdb-core';
import {tableToIPC} from 'apache-arrow';
import {z} from 'zod';
import type {openWorkspace} from './workspace';
import type {createWorkspaceAccess} from './access';

/** Compatible auth/SQL/Arrow and read-only committed-content/replay subscriptions. */
export function attachWorkspaceSockets(
  server: Server,
  options: {
    workspace: Awaited<ReturnType<typeof openWorkspace>>;
    access: ReturnType<typeof createWorkspaceAccess>;
    origin: () => string;
  },
) {
  const {workspace, access} = options;
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 33 * 1024 * 1024,
  });
  const work = new Set<Promise<void>>();
  let queryCount = 0;
  server.on('upgrade', (request, socket, head) => {
    try {
      if (
        new URL(request.url ?? '/', options.origin()).pathname !== '/ws' ||
        request.headers.host !== new URL(options.origin()).host ||
        (request.headers.origin && request.headers.origin !== options.origin())
      ) {
        socket.destroy();
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) =>
        wss.emit('connection', ws),
      );
    } catch {
      socket.destroy();
    }
  });
  wss.on('connection', (ws) => {
    let token = '',
      joined = false,
      disposed = false,
      replayAfter: number | undefined;
    let snapshotQueue = Promise.resolve();
    let session: ReturnType<typeof workspace.createQuerySession> | undefined;
    const queries = new Map<string, AbortController>();
    const sendText = (text: string) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (ws.bufferedAmount > 8 * 1024 * 1024) {
        ws.close(1013, 'Slow subscriber; reconnect to replay.');
        return;
      }
      ws.send(text);
    };
    const send = (value: unknown) => sendText(JSON.stringify(value));
    const authorize = () => access.verify(token, 'view');
    const snapshot = () => {
      snapshotQueue = snapshotQueue
        .then(async () => {
          if (!joined || disposed) return;
          authorize();
          const state = await workspace.snapshot();
          if (!joined || disposed) return;
          authorize();
          send({
            type: 'crdt-snapshot',
            roomId: 'workspace',
            data: Buffer.from(state.loro).toString('base64'),
            sequence: state.sequence,
            content: state.content,
            revisions: state.revisions,
            readOnly: true,
          });
        })
        .catch(() => ws.close(1008, 'Workspace unavailable.'));
    };
    const replay = () => {
      if (replayAfter === undefined || disposed) return;
      try {
        access.verify(token, 'runs');
        const page = workspace.runs.events(replayAfter, 500);
        for (const event of page) {
          send({type: 'run-event', event});
          replayAfter = event.seq;
        }
        if (page.length === 500) setImmediate(replay);
      } catch {
        ws.close(1008, 'Replay unavailable.');
      }
    };
    const unsubscribe = workspace.subscribe(snapshot);
    const unsubscribeRuns = workspace.runs.subscribe(replay);
    const authTimeout = setTimeout(() => {
      if (!token) ws.close(1008, 'Authentication required.');
    }, 5000);
    const expiry = setInterval(() => {
      if (token) {
        try {
          authorize();
        } catch {
          ws.close(1008, 'Credential expired.');
        }
      }
    }, 10000);
    ws.on('close', () => {
      disposed = true;
      clearTimeout(authTimeout);
      clearInterval(expiry);
      unsubscribe();
      unsubscribeRuns();
      for (const controller of queries.values()) controller.abort();
      if (session) {
        const task = session.dispose();
        work.add(task);
        void task.finally(() => work.delete(task));
      }
    });
    ws.on('error', () => ws.close());
    ws.on('message', (data, binary) => {
      const task = handle(data, binary).catch((error) =>
        send({
          type: 'error',
          error: String(
            error instanceof Error ? error.message : 'Invalid request.',
          ),
        }),
      );
      work.add(task);
      void task.finally(() => work.delete(task));
    });
    async function handle(data: import('ws').RawData, binary: boolean) {
      if (binary) {
        authorize();
        const bytes = Buffer.isBuffer(data)
          ? data
          : Buffer.concat(Array.isArray(data) ? data : [Buffer.from(data)]);
        const size = bytes.length >= 4 ? bytes.readUInt32BE(0) : 0;
        if (size > 0 && size <= 4096 && size + 4 < bytes.length) {
          let header;
          try {
            header = JSON.parse(bytes.subarray(4, size + 4).toString());
          } catch {
            /* Not an upload frame. */
          }
          if (header?.type === 'uploadArrow') {
            access.verify(token, 'edit');
            const parsed = z
              .object({
                queryId: z.string().min(1).max(200),
                tableName: z.string().min(1),
              })
              .parse(header);
            try {
              await workspace.upload(
                {
                  operationId: parsed.queryId,
                  tableName: parsed.tableName,
                  format: 'arrow',
                },
                bytes.subarray(size + 4),
              );
              send({type: 'uploadAck', queryId: parsed.queryId});
            } catch (error) {
              send({
                type: 'error',
                queryId: parsed.queryId,
                error:
                  error instanceof Error ? error.message : 'Upload failed.',
              });
            }
            return;
          }
        }
        send({
          type: 'error',
          code: 'document_read_only',
          error: 'Raw document updates are disabled.',
        });
        return;
      }
      if (data.toString().length > 256 * 1024)
        throw new Error('Request too large.');
      const frame = z
        .object({type: z.string()})
        .passthrough()
        .parse(JSON.parse(data.toString()));
      if (frame.type === 'auth') {
        if (token) throw new Error('Already authenticated.');
        const value = z.string().parse(frame.token);
        access.verify(value, 'view');
        session = workspace.createQuerySession();
        token = value;
        clearTimeout(authTimeout);
        send({
          type: 'authAck',
          capabilities: {
            querySession: 'connection',
            cache: 'mosaic',
            maxRows: 100000,
            maxResultBytes: 33554432,
          },
        });
        return;
      }
      authorize();
      if (frame.type === 'crdt-join') {
        if (frame.roomId !== 'workspace') {
          send({
            type: 'error',
            code: 'room_not_found',
            error: 'Unknown workspace room.',
          });
          return;
        }
        joined = true;
        send({type: 'crdt-joined', roomId: 'workspace', readOnly: true});
        snapshot();
        return;
      }
      if (frame.type === 'crdt-snapshot' || frame.type === 'crdt-update') {
        send({
          type: 'error',
          code: 'document_read_only',
          error: 'Document writes and snapshot seeding are disabled.',
        });
        return;
      }
      if (frame.type === 'run-subscribe') {
        access.verify(token, 'runs');
        replayAfter = z.number().int().nonnegative().parse(frame.afterSeq);
        replay();
        return;
      }
      if (frame.type === 'cancel') {
        queries.get(String(frame.queryId))?.abort();
        return;
      }
      if (!['arrow', 'json', 'exec'].includes(frame.type)) {
        send({
          type: 'error',
          queryId: frame.queryId,
          code: 'unsupported',
          error: 'Unsupported protocol operation.',
        });
        return;
      }
      const parsedRequest = z
        .object({
          queryId: z.string().min(1).max(200),
          sql: z.string().min(1).max(100000),
        })
        .safeParse(frame);
      if (!parsedRequest.success) {
        send({
          type: 'error',
          queryId:
            typeof frame.queryId === 'string' ? frame.queryId : undefined,
          error: 'Invalid query request.',
        });
        return;
      }
      const request = parsedRequest.data;
      if (queryCount >= 64 || queries.has(request.queryId)) {
        send({
          type: 'error',
          queryId: request.queryId,
          error: 'Query capacity or duplicate request ID.',
        });
        return;
      }
      const controller = new AbortController();
      queries.set(request.queryId, controller);
      queryCount++;
      try {
        const table = await session!.query(request.sql, controller.signal);
        authorize();
        if (controller.signal.aborted) throw new Error('Query cancelled.');
        if (frame.type === 'json') {
          const chunks: string[] = [];
          let size = 0;
          for (let offset = 0; offset < table.numRows; offset += 128) {
            for (const row of arrowTableToJson(
              table.slice(offset, offset + 128),
            )) {
              const value = JSON.stringify(row, (_, item) =>
                typeof item === 'bigint' ? item.toString() : item,
              );
              size += Buffer.byteLength(value) + 1;
              if (size > 32 * 1024 * 1024)
                throw new Error(
                  'JSON result exceeds 32 MiB; narrow the query.',
                );
              chunks.push(value);
            }
          }
          sendText(
            `{"type":"json","queryId":${JSON.stringify(request.queryId)},"data":[${chunks.join(',')}]}`,
          );
          return;
        }
        if (frame.type === 'exec') {
          send({type: 'ok', queryId: request.queryId});
          return;
        }
        const ipc = tableToIPC(table, 'stream');
        if (ipc.length > 32 * 1024 * 1024)
          throw new Error('Result exceeds 32 MiB; narrow the query.');
        const header = Buffer.from(
          JSON.stringify({type: 'arrow', queryId: request.queryId}),
        );
        const prefix = Buffer.alloc(4);
        prefix.writeUInt32BE(header.length);
        if (ws.bufferedAmount > 8 * 1024 * 1024) {
          ws.close(1013, 'Slow query subscriber.');
          return;
        }
        if (ws.readyState === WebSocket.OPEN)
          ws.send(Buffer.concat([prefix, header, ipc]));
      } catch (error) {
        send({
          type: 'error',
          queryId: request.queryId,
          error: controller.signal.aborted
            ? 'Query cancelled.'
            : String(error instanceof Error ? error.message : 'Query failed.'),
        });
      } finally {
        queryCount--;
        queries.delete(request.queryId);
      }
    }
  });
  return {
    async dispose() {
      for (const ws of wss.clients) ws.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await Promise.allSettled([...work]);
    },
  };
}
