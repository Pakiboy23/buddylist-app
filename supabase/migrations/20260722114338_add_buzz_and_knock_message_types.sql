begin;

alter table public.messages
  drop constraint if exists messages_preview_type_check;

alter table public.messages
  add constraint messages_preview_type_check
  check (preview_type in ('text', 'attachment', 'forwarded', 'voice_note', 'buzz', 'knock'))
  not valid;

alter table public.messages
  validate constraint messages_preview_type_check;

create or replace function public.enforce_knock_rules()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.preview_type is distinct from 'knock' then
    return new;
  end if;

  if not exists (
    select 1
    from public.buddies b
    where b.status = 'accepted'
      and (
        (b.user_id = new.sender_id and b.buddy_id = new.receiver_id)
        or (b.user_id = new.receiver_id and b.buddy_id = new.sender_id)
      )
  ) then
    raise exception 'KNOCK_BUDDIES_ONLY: You can only knock on a buddy.'
      using errcode = 'PT403', hint = 'KNOCK_BUDDIES_ONLY';
  end if;

  if exists (
    select 1
    from public.messages m
    where m.sender_id = new.sender_id
      and m.receiver_id = new.receiver_id
      and m.preview_type = 'knock'
      and m.created_at > now() - interval '10 minutes'
  ) then
    raise exception 'KNOCK_COOLDOWN: Give them a little time before knocking again.'
      using errcode = 'PT429', hint = 'KNOCK_COOLDOWN';
  end if;

  new.content := '👋 Knock';
  return new;
end;
$$;

comment on function public.enforce_knock_rules() is
  'Restricts Knock messages to accepted buddies and one Knock per sender-recipient pair every 10 minutes.';

revoke all on function public.enforce_knock_rules() from public, anon, authenticated;

drop trigger if exists messages_enforce_knock_rules on public.messages;
create trigger messages_enforce_knock_rules
before insert on public.messages
for each row execute function public.enforce_knock_rules();

commit;
