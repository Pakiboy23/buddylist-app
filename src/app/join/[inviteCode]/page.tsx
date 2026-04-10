import { redirect } from 'next/navigation';
import RetroWindow from '@/components/RetroWindow';
import { createSupabaseAdminClient } from '@/lib/supabaseServer';

/**
 * Resolves a shareable invite link server-side and routes to the correct destination.
 * The invite_code is never forwarded to the client — only the resulting roomId is.
 *
 * Public / Invite rooms → redirect to the room preview page (join CTA is there).
 * Private rooms → redirect to preview with ?via=invite so the preview page auto-joins.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = await params;

  const supabase = createSupabaseAdminClient();

  const { data: room } = await supabase
    .from('chat_rooms')
    .select('id, name, room_type')
    .eq('invite_code', inviteCode)
    .maybeSingle();

  if (!room) {
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

  if (room.room_type === 'private') {
    // Pass via=invite so the preview page knows to auto-join without showing the CTA.
    redirect(`/hi-its-me/rooms/${room.id}/preview?via=invite`);
  }

  // public or invite — let the preview page handle the join CTA
  redirect(`/hi-its-me/rooms/${room.id}/preview`);
}
