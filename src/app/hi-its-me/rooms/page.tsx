import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RetroWindow from '@/components/RetroWindow';
import { supabase } from '@/lib/supabase';
import RoomListClient from './RoomListClient';

export interface RoomRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  kind: 'regional' | 'vibe';
  region_code: string | null;
  display_order: number;
}

export default function RoomsPage() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRooms() {
      const { data, error } = await supabase
        .from('rooms')
        .select('id,slug,name,description,kind,region_code,display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('rooms fetch error:', error.message);
      }
      setRooms((data ?? []) as RoomRow[]);
      setIsLoading(false);
    }
    void fetchRooms();
  }, []);

  return (
    <RetroWindow
      title="Chat Rooms"
      showBackButton
      onBack={() => navigate('/hi-its-me?tab=chat')}
    >
      {isLoading ? <div className="h-20" /> : <RoomListClient rooms={rooms} />}
    </RetroWindow>
  );
}
