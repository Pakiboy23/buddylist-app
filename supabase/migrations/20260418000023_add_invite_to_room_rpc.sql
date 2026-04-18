create or replace function public.invite_to_room(
  p_room_key text,
  p_invitee_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_name text;
begin
  if not exists (
    select 1 from room_participants
    where room_key = p_room_key and user_id = auth.uid()
  ) then
    raise exception 'Not a member of this room';
  end if;

  if exists (
    select 1 from room_participants
    where room_key = p_room_key and user_id = p_invitee_id
  ) then
    return;
  end if;

  select name into v_room_name
  from chat_rooms
  where room_key = p_room_key;

  if v_room_name is null then
    raise exception 'Room not found';
  end if;

  insert into room_participants (room_key, user_id)
  values (p_room_key, p_invitee_id);

  insert into user_active_rooms (user_id, room_key, room_name)
  values (p_invitee_id, p_room_key, v_room_name)
  on conflict (user_id, room_key) do nothing;
end;
$$;

grant execute on function public.invite_to_room(text, uuid) to authenticated;
