import { useState, type FormEvent } from 'react';
import ContentManager, { type FormProps } from '@/admin/ContentManager';
import { errorMessage, isAuthError, isUploadedMediaUrl, saveAdminRow } from '@/admin/adminApi';
import MediaUploader from '@/admin/MediaUploader';
import { Checkbox, Field, Notice, inputClass, primaryButtonClass, secondaryButtonClass } from '@/admin/adminUi';
import { youtubeThumbnailUrl, youtubeVideoId } from '@/lib/youtube';
import type { Episode } from '@/types';

function CoverPreview({ cover, videoId }: { cover: string | null; videoId: string | null }) {
  const [fallback, setFallback] = useState(false);

  if (cover) {
    return <img src={cover} alt="Custom cover" className="aspect-video w-full rounded-xl object-cover" />;
  }
  if (!videoId) {
    return <div className="flex aspect-video items-center justify-center rounded-xl bg-[#171717] p-4 text-center text-sm text-[#c4c0b7]">Paste a YouTube link to preview the automatic thumbnail</div>;
  }
  return (
    <img
      src={youtubeThumbnailUrl(videoId, fallback ? 'hqdefault' : 'maxresdefault')}
      alt="Automatic YouTube thumbnail"
      className="aspect-video w-full rounded-xl object-cover"
      onLoad={(event) => {
        if (!fallback && event.currentTarget.naturalWidth <= 120) setFallback(true);
      }}
      onError={() => setFallback(true)}
    />
  );
}

function EpisodeForm({ initial, onAuthLost, onSaved, onCancel }: FormProps<Episode>) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [guestNames, setGuestNames] = useState(initial?.guest_names ?? '');
  const [youtubeUrl, setYoutubeUrl] = useState(initial?.youtube_url ?? '');
  const initialCover = initial?.thumbnail_url ?? null;
  const [cover, setCover] = useState<string | null>(isUploadedMediaUrl(initialCover) ? initialCover : null);
  const [featured, setFeatured] = useState(initial?.is_featured ?? false);
  const [published, setPublished] = useState(initial?.is_published ?? false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const videoId = youtubeVideoId(youtubeUrl);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!videoId) {
      setError('That YouTube link is not recognised. Use a watch, youtu.be or Shorts link.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveAdminRow<Episode>('episodes', initial?.id ?? null, {
        title,
        description,
        guest_names: guestNames,
        youtube_url: youtubeUrl,
        thumbnail_url: cover,
        is_featured: featured,
        is_published: published,
        published_at: initial?.published_at ?? null,
      });
      await onSaved();
    } catch (err) {
      if (isAuthError(err)) onAuthLost();
      else setError(errorMessage(err, 'Could not save the episode. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Episode title"><input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} /></Field>
        <Field label="Guests" hint="Optional"><input maxLength={300} value={guestNames} onChange={(e) => setGuestNames(e.target.value)} className={inputClass} /></Field>
        <div className="sm:col-span-2">
          <Field label="YouTube link" hint="Watch, youtu.be or Shorts links all work.">
            <input required type="url" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} className={inputClass} placeholder="https://www.youtube.com/watch?v=..." />
          </Field>
        </div>
      </div>

      <Field label="Description"><textarea rows={3} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} /></Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-sm font-bold">Thumbnail preview</p>
          <p className="mt-1 text-xs text-[#77736a]">Automatic from YouTube unless you upload a custom cover.</p>
          <div className="mt-2"><CoverPreview key={videoId ?? 'none'} cover={cover} videoId={videoId} /></div>
        </div>
        <MediaUploader label="Custom cover" hint="Optional. Leave empty to use the YouTube thumbnail." kind="episode-cover" mediaType="image" value={cover} onChange={setCover} onAuthLost={onAuthLost} onBusyChange={setMediaBusy} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Checkbox label="Feature on the home page" checked={featured} onChange={setFeatured} />
        <Checkbox label="Show on the public site" checked={published} onChange={setPublished} />
      </div>

      {error && <Notice>{error}</Notice>}

      <div className="flex justify-end gap-3 border-t border-[#ece9e1] pt-5">
        <button type="button" onClick={onCancel} disabled={saving} className={secondaryButtonClass}>Cancel</button>
        <button type="submit" disabled={saving || mediaBusy} className={primaryButtonClass}>{mediaBusy ? 'Wait for upload...' : saving ? 'Saving...' : 'Save episode'}</button>
      </div>
    </form>
  );
}

export default function EpisodesManager({ onAuthLost, onChanged }: { onAuthLost: () => void; onChanged: () => Promise<void> }) {
  return (
    <ContentManager<Episode>
      table="episodes"
      noun="episode"
      newLabel="New episode"
      emptyText="No episodes yet. Paste a YouTube link to add your first episode."
      describe={(row) => ({
        title: row.title,
        subtitle: row.guest_names || 'No guests listed',
        thumbnail: row.thumbnail_url ?? (row.youtube_video_id ? youtubeThumbnailUrl(row.youtube_video_id) : null),
      })}
      Form={EpisodeForm}
      onAuthLost={onAuthLost}
      onChanged={onChanged}
    />
  );
}
