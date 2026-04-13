import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import RetroWindow from '@/components/RetroWindow';
import { supabase } from '@/lib/supabase';
import RoomListClient from './RoomListClient';

interface PublicRoom {
  id: string;
  name: string;
  description: string | null;
  tags: string[] | null;
  room_key: string;
  member_count: number;
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRooms() {
      const { data, error } = await supabase.rpc('get_public_rooms');
      if (error) {
        console.error('get_public_rooms error:', error.message);
      }
      setRooms((data ?? []) as PublicRoom[]);
      setIsLoading(false);
    }
    void fetchRooms();
  }, []);

  return (
    <RetroWindow
      title="Chat Rooms"
      headerActions={
        <Link
          to="/hi-its-me/rooms/new"
          className="ui-focus-ring ui-button-primary rounded-xl px-3 py-1.5 text-[length:var(--ui-text-xs)] font-semibold"
        >
          Create Room
        </Link>
      }
    >
      {isLoading ? <div className="h-20" /> : <RoomListClient rooms={rooms} />}
    </RetroWindow>
  );
}
