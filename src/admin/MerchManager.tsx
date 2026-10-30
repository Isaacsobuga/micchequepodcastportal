import { useState, type FormEvent } from 'react';
import ContentManager, { type FormProps } from '@/admin/ContentManager';
import { errorMessage, isAuthError, saveAdminRow } from '@/admin/adminApi';
import MediaUploader from '@/admin/MediaUploader';
import { Checkbox, Field, Notice, inputClass, primaryButtonClass, secondaryButtonClass } from '@/admin/adminUi';
import type { Merchandise } from '@/types';

function MerchForm({ initial, onAuthLost, onSaved, onCancel }: FormProps<Merchandise>) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [priceText, setPriceText] = useState(initial?.price_text ?? '');
  const [externalUrl, setExternalUrl] = useState(initial?.external_url ?? '');
  const [image, setImage] = useState<string | null>(initial?.image_url ?? null);
  const [featured, setFeatured] = useState(initial?.is_featured ?? false);
  const [published, setPublished] = useState(initial?.is_published ?? false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await saveAdminRow<Merchandise>('merchandise', initial?.id ?? null, {
        name,
        description,
        price_text: priceText,
        external_url: externalUrl,
        image_url: image,
        is_featured: featured,
        is_published: published,
      });
      await onSaved();
    } catch (err) {
      if (isAuthError(err)) onAuthLost();
      else setError(errorMessage(err, 'Could not save the product. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Product name"><input required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></Field>
        <Field label="Price" hint="Optional, e.g. KES 1,500"><input maxLength={60} value={priceText} onChange={(e) => setPriceText(e.target.value)} className={inputClass} /></Field>
        <div className="sm:col-span-2">
          <Field label="Official shop link" hint="Must start with https://">
            <input required type="url" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} className={inputClass} />
          </Field>
        </div>
      </div>

      <Field label="Description"><textarea rows={3} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} /></Field>

      <div className="max-w-sm">
        <MediaUploader label="Product image" kind="merch-image" mediaType="image" value={image} onChange={setImage} onAuthLost={onAuthLost} onBusyChange={setMediaBusy} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Checkbox label="Feature on the home page" checked={featured} onChange={setFeatured} />
        <Checkbox label="Show on the public site" checked={published} onChange={setPublished} />
      </div>

      {error && <Notice>{error}</Notice>}

      <div className="flex justify-end gap-3 border-t border-[#ece9e1] pt-5">
        <button type="button" onClick={onCancel} disabled={saving} className={secondaryButtonClass}>Cancel</button>
        <button type="submit" disabled={saving || mediaBusy} className={primaryButtonClass}>{mediaBusy ? 'Wait for upload...' : saving ? 'Saving...' : 'Save product'}</button>
      </div>
    </form>
  );
}

export default function MerchManager({ onAuthLost, onChanged }: { onAuthLost: () => void; onChanged: () => Promise<void> }) {
  return (
    <ContentManager<Merchandise>
      table="merchandise"
      noun="product"
      newLabel="New product"
      emptyText="No merchandise yet. Add a product to link fans to the official shop."
      describe={(row) => ({ title: row.name, subtitle: row.price_text || 'No price listed', thumbnail: row.image_url })}
      Form={MerchForm}
      onAuthLost={onAuthLost}
      onChanged={onChanged}
    />
  );
}
