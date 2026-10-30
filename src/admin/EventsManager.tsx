import { useState, type FormEvent } from 'react';
import ContentManager, { type FormProps } from '@/admin/ContentManager';
import { errorMessage, isAuthError, saveAdminRow } from '@/admin/adminApi';
import MediaUploader from '@/admin/MediaUploader';
import { Checkbox, Field, Notice, inputClass, primaryButtonClass, secondaryButtonClass } from '@/admin/adminUi';
import type { EventItem, EventStatus } from '@/types';

const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'live', label: 'Live now' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const NAIROBI_OFFSET = '+03:00';

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Nairobi' }).format(new Date(iso));
}

function toNairobiInput(iso: string | null): string {
  if (!iso) return '';
  return new Date(Date.parse(iso) + 3 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

function nairobiInputToIso(value: string): string | null {
  const time = Date.parse(`${value}:00${NAIROBI_OFFSET}`);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function EventForm({ initial, onAuthLost, onSaved, onCancel }: FormProps<EventItem>) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [venue, setVenue] = useState(initial?.venue ?? '');
  const [startsAt, setStartsAt] = useState(toNairobiInput(initial?.starts_at ?? null));
  const [endsAt, setEndsAt] = useState(toNairobiInput(initial?.ends_at ?? null));
  const [status, setStatus] = useState<EventStatus>(initial?.status ?? 'scheduled');
  const [actionLabel, setActionLabel] = useState(initial?.action_label ?? '');
  const [actionUrl, setActionUrl] = useState(initial?.action_url ?? '');
  const [poster, setPoster] = useState<string | null>(initial?.media_url ?? null);
  const [video, setVideo] = useState<string | null>(initial?.video_url ?? null);
  const [featured, setFeatured] = useState(initial?.is_featured ?? false);
  const [published, setPublished] = useState(initial?.is_published ?? false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const starts = nairobiInputToIso(startsAt);
    const ends = nairobiInputToIso(endsAt);
    if (!starts || !ends) {
      setError('Choose a valid start and end time (Nairobi time).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveAdminRow<EventItem>('events', initial?.id ?? null, {
        title,
        description,
        venue,
        starts_at: starts,
        ends_at: ends,
        status,
        media_type: video ? 'video' : 'image',
        media_url: poster,
        video_url: video,
        action_label: actionLabel,
        action_url: actionUrl,
        is_featured: featured,
        is_published: published,
      });
      await onSaved();
    } catch (err) {
      if (isAuthError(err)) onAuthLost();
      else setError(errorMessage(err, 'Could not save the event. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Event title"><input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} /></Field>
        <Field label="Venue"><input maxLength={200} value={venue} onChange={(e) => setVenue(e.target.value)} className={inputClass} /></Field>
        <Field label="Starts (Nairobi time)"><input required type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} /></Field>
        <Field label="Ends (Nairobi time)"><input required type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputClass} /></Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as EventStatus)} className={inputClass}>
            {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
        <Field label="Button label" hint="Optional, e.g. Get tickets"><input maxLength={60} value={actionLabel} onChange={(e) => setActionLabel(e.target.value)} className={inputClass} /></Field>
        <div className="sm:col-span-2">
          <Field label="Button link" hint="Optional. Must start with https://"><input type="url" value={actionUrl} onChange={(e) => setActionUrl(e.target.value)} className={inputClass} /></Field>
        </div>
      </div>

      <Field label="Description"><textarea rows={4} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} /></Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <MediaUploader label="Poster image" kind="event-poster" mediaType="image" value={poster} onChange={setPoster} onAuthLost={onAuthLost} onBusyChange={setMediaBusy} />
        <MediaUploader label="Event video" hint="Optional. Shown on the event card." kind="event-video" mediaType="video" value={video} onChange={setVideo} onAuthLost={onAuthLost} onBusyChange={setMediaBusy} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Checkbox label="Feature on the home page" checked={featured} onChange={setFeatured} />
        <Checkbox label="Show on the public site" checked={published} onChange={setPublished} />
      </div>

      {error && <Notice>{error}</Notice>}

      <div className="flex justify-end gap-3 border-t border-[#ece9e1] pt-5">
        <button type="button" onClick={onCancel} disabled={saving} className={secondaryButtonClass}>Cancel</button>
        <button type="submit" disabled={saving || mediaBusy} className={primaryButtonClass}>{mediaBusy ? 'Wait for upload...' : saving ? 'Saving...' : 'Save event'}</button>
      </div>
    </form>
  );
}

export default function EventsManager({ onAuthLost, onChanged }: { onAuthLost: () => void; onChanged: () => Promise<void> }) {
  return (
    <ContentManager<EventItem>
      table="events"
      noun="event"
      newLabel="New event"
      emptyText="No events yet. Create your first event to show it on the calendar."
      describe={(row) => ({
        title: row.title,
        subtitle: `${formatWhen(row.starts_at)} · ${STATUS_OPTIONS.find((option) => option.value === row.status)?.label ?? row.status}`,
        thumbnail: row.media_url,
      })}
      Form={EventForm}
      onAuthLost={onAuthLost}
      onChanged={onChanged}
    />
  );
}
