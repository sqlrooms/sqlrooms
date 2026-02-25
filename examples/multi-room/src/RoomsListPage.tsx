import {useCallback, useEffect, useState} from 'react';
import {useNavigate} from '@tanstack/react-router';
import {Button, Input} from '@sqlrooms/ui';
import {
  RoomRecord,
  getAllRooms,
  putRoom,
  deleteRoom as deleteRoomFromDb,
} from './rooms-db';

export function RoomsListPage() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const loadRooms = useCallback(async () => {
    setRooms(await getAllRooms());
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const addRoom = async () => {
    const room: RoomRecord = {
      id: crypto.randomUUID(),
      name: 'New Room',
      dataSources: [],
      createdAt: Date.now(),
    };
    await putRoom(room);
    await loadRooms();
    setEditingId(room.id);
    setEditName(room.name);
  };

  const startRename = (room: RoomRecord) => {
    setEditingId(room.id);
    setEditName(room.name);
  };

  const confirmRename = async () => {
    if (!editingId) return;
    const room = rooms.find((r) => r.id === editingId);
    if (room && editName.trim()) {
      await putRoom({...room, name: editName.trim()});
      await loadRooms();
    }
    setEditingId(null);
  };

  const handleDeleteRoom = async (id: string) => {
    await deleteRoomFromDb(id);
    await loadRooms();
  };

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Rooms</h1>
        <Button onClick={addRoom} size="sm">
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
                    {room.dataSources.length} source
                    {room.dataSources.length !== 1 ? 's' : ''}
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
                    onClick={() => handleDeleteRoom(room.id)}
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
