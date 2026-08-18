import {z} from 'zod';

/** Keep paired with python/sqlrooms/sqlrooms/web/mcp_bridge.py. */
export const MCP_BRIDGE_PROTOCOL_VERSION = 1 as const;

const BridgeBase = z.object({version: z.literal(MCP_BRIDGE_PROTOCOL_VERSION)});

const BrowserBridgeResponse = z.union([
  BridgeBase.extend({
    type: z.literal('bridge.response'),
    pageId: z.string().min(1).max(256),
    requestId: z.string().min(1).max(256),
    ok: z.literal(true),
    result: z.unknown(),
  }),
  BridgeBase.extend({
    type: z.literal('bridge.response'),
    pageId: z.string().min(1).max(256),
    requestId: z.string().min(1).max(256),
    ok: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
      retryable: z.boolean().optional(),
    }),
  }),
]);

/** Browser-to-host messages for SQLRooms bridge protocol version 1. */
export const BrowserBridgeClientMessage = z.union([
  BridgeBase.extend({
    type: z.literal('bridge.authenticate'),
    pageId: z.string().min(1).max(256),
    token: z.string().min(1),
  }),
  BridgeBase.extend({
    type: z.literal('bridge.ready'),
    pageId: z.string().min(1).max(256),
  }),
  BridgeBase.extend({
    type: z.literal('bridge.gone'),
    pageId: z.string().min(1).max(256),
  }),
  BridgeBase.extend({
    type: z.literal('bridge.heartbeat'),
    pageId: z.string().min(1).max(256),
  }),
  BrowserBridgeResponse,
]);

/** Host-to-browser messages for SQLRooms bridge protocol version 1. */
export const BrowserBridgeServerMessage = z.discriminatedUnion('type', [
  BridgeBase.extend({type: z.literal('bridge.authenticated')}),
  BridgeBase.extend({
    type: z.literal('bridge.request'),
    requestId: z.string().min(1).max(256),
    method: z.enum(['tools.list', 'tools.call']),
    params: z.unknown().optional(),
  }),
  BridgeBase.extend({
    type: z.literal('request.cancel'),
    requestId: z.string().min(1).max(256),
  }),
  BridgeBase.extend({
    type: z.literal('bridge.error'),
    code: z.string(),
    message: z.string(),
  }),
]);

export type BrowserBridgeClientMessage = z.infer<
  typeof BrowserBridgeClientMessage
>;
export type BrowserBridgeServerMessage = z.infer<
  typeof BrowserBridgeServerMessage
>;
