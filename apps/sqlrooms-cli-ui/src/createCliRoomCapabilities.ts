import {createSqlRoomsRoomCapabilities} from '@sqlrooms/mcp/sqlrooms';
import {roomStore} from './store';

const MCP_EXCLUDED_COMMAND_IDS = [
  'db.create-table-from-query',
  'room.add-sql-data-source',
  'sql-editor.run-current-query',
  'sql-editor.run-query',
] as const;

type CreateCliRoomCapabilitiesOptions = {
  metaNamespace?: string;
};

/** Creates the standard SQLRooms catalog for the live CLI room store. */
export function createCliRoomCapabilities({
  metaNamespace = '__sqlrooms',
}: CreateCliRoomCapabilitiesOptions = {}) {
  return createSqlRoomsRoomCapabilities({
    store: roomStore,
    metaNamespace,
    excludedCommandIds: MCP_EXCLUDED_COMMAND_IDS,
  });
}
