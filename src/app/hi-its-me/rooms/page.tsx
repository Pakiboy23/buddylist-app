import Link from 'next/link';
import RetroWindow from '@/components/RetroWindow';
import { createSupabaseAdminClient } from '@/lib/supabaseServer';
import RoomListClient from './RoomListClient';

async function getPublicRooms() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('get_public_rooms');
  if (error) {
    console.error('get_public_rooms error:', error.message);
    return [];
  }
  return (data ?? []) as Array<{
    id: string;
    name: string;
    description: string | null;
    tags: string[] | null;
    room_key: string;
    member_count: number;
  }>;
}

export default async function RoomsPage() {
  const rooms = await getPublicRooms();

  return (
    <RetroWindow
      title="Chat Rooms"
      headerActions={
        <Link
          href="/hi-its-me/rooms/new"
          className="ui-focus-ring ui-button-primary rounded-xl px-3 py-1.5 text-[length:var(--ui-text-xs)] font-semibold"
        >
          Create Room
        </Link>
      }
    >
      <RoomListClient rooms={rooms} />
    </RetroWindow>
  );
}
