import {DataSource} from '@sqlrooms/room-shell';

export interface RoomListEntry {
  id: string;
  name: string;
  defaultDataSources: DataSource[];
}

const STORAGE_KEY = 'multi-room-rooms-list';

export function getRoomsList(): RoomListEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRoomsList(rooms: RoomListEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
}

export function getRoom(id: string): RoomListEntry | undefined {
  return getRoomsList().find((r) => r.id === id);
}

export function addRoom(room: RoomListEntry): void {
  saveRoomsList([...getRoomsList(), room]);
}

export function renameRoom(id: string, name: string): void {
  saveRoomsList(getRoomsList().map((r) => (r.id === id ? {...r, name} : r)));
}

export function deleteRoom(id: string): void {
  saveRoomsList(getRoomsList().filter((r) => r.id !== id));
  localStorage.removeItem(`multi-room-${id}`);
}

export function seedDefaultRooms(): void {
  if (getRoomsList().length > 0) return;

  saveRoomsList([
    {
      id: 'earthquakes',
      name: 'Earthquakes',
      defaultDataSources: [
        {
          type: 'url',
          url: 'https://huggingface.co/datasets/sqlrooms/earthquakes/resolve/main/earthquakes.parquet',
          tableName: 'earthquakes',
        },
      ],
    },
    {
      id: 'bixi',
      name: 'BIXI Locations 2025',
      defaultDataSources: [
        {
          type: 'url',
          url: 'https://huggingface.co/datasets/sqlrooms/bixi-2025/resolve/main/bixi-locations-2025.parquet',
          tableName: 'bixi_locations',
        },
      ],
    },
  ]);
}
