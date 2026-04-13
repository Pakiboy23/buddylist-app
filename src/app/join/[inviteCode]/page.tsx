import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import RetroWindow from '@/components/RetroWindow';
import { supabase } from '@/lib/supabase';

export default function InvitePage() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!inviteCode) {
      setInvalid(true);
      return;
    }

    supabase
      .from('chat_rooms')
      .select('id, name, room_type')
      .eq('invite_code', inviteCode)
      .maybeSingle()
      .then(({ data: room }) => {
        if (!room) {
          setInvalid(true);
          return;
        }

        if (room.room_type === 'private') {
          setRedirectTo(`/hi-its-me/rooms/${room.id}/preview?via=invite`);
        } else {
          setRedirectTo(`/hi-its-me/rooms/${room.id}/preview`);
        }
      });
  }, [inviteCode]);

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  if (invalid) {
    return (
      <RetroWindow title="Invalid Link">
        <div className="mt-6 px-1">
          <p role="alert" className="ui-note-error text-[length:var(--ui-text-sm)] font-semibold">
            This invite link is invalid or has expired.
          </p>
        </div>
      </RetroWindow>
    );
  }

  // Loading — room lookup in progress
  return null;
}
