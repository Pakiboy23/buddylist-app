import { useState } from 'react';
import { useAppRouter } from '@/lib/appNavigation';
import RetroWindow from '@/components/RetroWindow';
import { supabase } from '@/lib/supabase';
import { waitForSessionOrNull } from '@/lib/authClient';

const ROOM_TYPES = [
  { value: 'public',  label: 'Public',       description: 'Anyone can find and join' },
  { value: 'invite',  label: 'Invite Only',  description: 'Only people with your link can join' },
  { value: 'private', label: 'Private',      description: 'Invite members directly, not searchable' },
] as const;

type RoomType = (typeof ROOM_TYPES)[number]['value'];

const MAX_TAGS = 5;

export default function NewRoomPage() {
  const router = useAppRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [roomType, setRoomType] = useState<RoomType>('public');
  const [memberCap, setMemberCap] = useState('');

  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function checkNameUnique(value: string) {
    if (!value.trim()) return;
    const { data } = await supabase
      .from('chat_rooms')
      .select('id')
      .ilike('name', value.trim())
      .maybeSingle();
    if (data) {
      setNameError('A room with this name already exists.');
    } else {
      setNameError(null);
    }
  }

  function addTag() {
    const raw = tagInput.trim().toLowerCase();
    if (!raw || tags.includes(raw) || tags.length >= MAX_TAGS) return;
    setTags([...tags, raw]);
    setTagInput('');
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || nameError) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const session = await waitForSessionOrNull();
    if (!session) {
      setSubmitError('You must be signed in to create a room.');
      setIsSubmitting(false);
      return;
    }

    const cap = memberCap ? parseInt(memberCap, 10) : null;
    if (cap !== null && (isNaN(cap) || cap < 2)) {
      setSubmitError('Member cap must be at least 2.');
      setIsSubmitting(false);
      return;
    }

    const { data: room, error } = await supabase
      .from('chat_rooms')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        tags: tags.length > 0 ? tags : null,
        room_type: roomType,
        member_cap: cap,
        created_by: session.user.id,
      })
      .select('id, room_key, name')
      .single();

    if (error || !room) {
      setSubmitError(error?.message ?? 'Failed to create room.');
      setIsSubmitting(false);
      return;
    }

    // Join the room as creator
    await supabase.from('user_active_rooms').insert({
      user_id: session.user.id,
      room_key: room.room_key,
      room_name: room.name,
      unread_count: 0,
    });

    router.push(`/hi-its-me/rooms/${room.id}/preview`);
  }

  return (
    <RetroWindow
      title="New Room"
      showBackButton
      onBack={() => router.push('/hi-its-me/rooms')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Room name */}
        <div>
          <label className="mb-1.5 block text-[length:var(--ui-text-2xs)] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Room Name <span aria-hidden="true">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(null);
            }}
            onBlur={(e) => void checkNameUnique(e.target.value)}
            maxLength={80}
            placeholder="e.g. Late Night Vibes"
            className="ui-focus-ring w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[length:var(--ui-text-sm)] text-slate-700 placeholder-slate-400 dark:border-slate-700 dark:bg-[#13100E] dark:text-slate-100 dark:placeholder-slate-500"
          />
          {nameError ? (
            <p role="alert" className="mt-1 text-[length:var(--ui-text-xs)] text-red-500">
              {nameError}
            </p>
          ) : null}
        </div>

        {/* Description */}
        <div>
          <label className="mb-1.5 block text-[length:var(--ui-text-2xs)] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="What's this room about?"
            className="ui-focus-ring w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[length:var(--ui-text-sm)] text-slate-700 placeholder-slate-400 dark:border-slate-700 dark:bg-[#13100E] dark:text-slate-100 dark:placeholder-slate-500"
          />
          <p className="mt-0.5 text-right text-[length:var(--ui-text-2xs)] text-slate-400">
            {description.length}/200
          </p>
        </div>

        {/* Tags */}
        <div>
          <label className="mb-1.5 block text-[length:var(--ui-text-2xs)] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Tags{' '}
            <span className="normal-case tracking-normal font-normal">
              (max {MAX_TAGS}, press Enter or comma to add)
            </span>
          </label>
          {tags.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ui-focus-ring flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[length:var(--ui-text-2xs)] font-medium text-slate-600 dark:bg-[#13100E] dark:text-slate-300"
                  aria-label={`Remove tag ${tag}`}
                >
                  {tag}
                  <span aria-hidden="true" className="text-slate-400">×</span>
                </button>
              ))}
            </div>
          ) : null}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={addTag}
            disabled={tags.length >= MAX_TAGS}
            placeholder={tags.length >= MAX_TAGS ? 'Max tags reached' : 'music, gaming, chill…'}
            className="ui-focus-ring w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[length:var(--ui-text-sm)] text-slate-700 placeholder-slate-400 disabled:opacity-50 dark:border-slate-700 dark:bg-[#13100E] dark:text-slate-100 dark:placeholder-slate-500"
          />
        </div>

        {/* Room type */}
        <div>
          <label className="mb-1.5 block text-[length:var(--ui-text-2xs)] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Room Type
          </label>
          <div className="space-y-2">
            {ROOM_TYPES.map((type) => (
              <label
                key={type.value}
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-700"
                style={{
                  background: roomType === type.value ? 'var(--ui-panel-bg, #fff)' : 'transparent',
                }}
              >
                <input
                  type="radio"
                  name="room_type"
                  value={type.value}
                  checked={roomType === type.value}
                  onChange={() => setRoomType(type.value)}
                  className="mt-0.5 accent-[var(--rose)]"
                />
                <div>
                  <p className="text-[length:var(--ui-text-sm)] font-semibold text-slate-800">
                    {type.label}
                  </p>
                  <p className="text-[length:var(--ui-text-xs)] text-slate-500">{type.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Member cap */}
        <div>
          <label className="mb-1.5 block text-[length:var(--ui-text-2xs)] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Max Members{' '}
            <span className="normal-case tracking-normal font-normal">
              — leave blank for no limit
            </span>
          </label>
          <input
            type="number"
            value={memberCap}
            onChange={(e) => setMemberCap(e.target.value)}
            min={2}
            max={10000}
            placeholder="e.g. 50"
            className="ui-focus-ring w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[length:var(--ui-text-sm)] text-slate-700 placeholder-slate-400 dark:border-slate-700 dark:bg-[#13100E] dark:text-slate-100 dark:placeholder-slate-500"
          />
        </div>

        {submitError ? (
          <p role="alert" className="ui-note-error text-[length:var(--ui-text-sm)] font-semibold">
            {submitError}
          </p>
        ) : null}

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isSubmitting || !name.trim() || Boolean(nameError)}
            className="ui-focus-ring ui-button-primary rounded-2xl px-6 py-2.5 text-[length:var(--ui-text-md)] disabled:opacity-60"
          >
            {isSubmitting ? 'Creating…' : 'Create Room'}
          </button>
        </div>
      </form>
    </RetroWindow>
  );
}
