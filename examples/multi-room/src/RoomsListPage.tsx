import {Button, Input} from '@sqlrooms/ui';
import {useNavigate} from '@tanstack/react-router';
import {useCallback, useEffect, useState} from 'react';
import {
  RoomListEntry,
  addRoom,
  deleteRoom,
  getRoomsList,
  renameRoom,
} from './rooms-list';

export function RoomsListPage() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomListEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const loadRooms = useCallback(() => setRooms(getRoomsList()), []);
  useEffect(loadRooms, [loadRooms]);

  const handleAdd = () => {
    const room: RoomListEntry = {
      id: crypto.randomUUID(),
      name: 'New Room',
      defaultDataSources: [],
    };
    addRoom(room);
    loadRooms();
    setEditingId(room.id);
    setEditName(room.name);
  };

  const startRename = (room: RoomListEntry) => {
    setEditingId(room.id);
    setEditName(room.name);
  };

  const confirmRename = () => {
    if (editingId && editName.trim()) {
      renameRoom(editingId, editName.trim());
      loadRooms();
    }
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    deleteRoom(id);
    loadRooms();
  };

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Rooms</h1>
        <Button onClick={handleAdd} size="sm">
          + New Room
        </Button>
      </div>
      {rooms.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No rooms yet. Create one to get started.
        </p>
      ) : (
        <ul className="space-y-2">
          {rooms.map((room) => (
            <li
              key={room.id}
              className="border-border bg-card flex items-center gap-3 rounded-lg border px-4 py-3"
            >
              {editingId === room.id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    confirmRename();
                  }}
                >
                  <Input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 flex-1"
                    onBlur={confirmRename}
                  />
                  <Button type="submit" size="sm" variant="outline">
                    Save
                  </Button>
                </form>
              ) : (
                <>
                  <button
                    className="flex-1 text-left font-medium hover:underline"
                    onClick={() =>
                      navigate({to: '/room/$id', params: {id: room.id}})
                    }
                  >
                    {room.name}
                  </button>
                  <span className="text-muted-foreground text-xs">
                    {room.defaultDataSources.length} source
                    {room.defaultDataSources.length !== 1 ? 's' : ''}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => startRename(room)}
                  >
                    Rename
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(room.id)}
                  >
                    Delete
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
