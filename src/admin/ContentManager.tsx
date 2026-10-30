import { useState, type ComponentType } from 'react';
import { Eye, EyeOff, ImageIcon, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { type AdminTable, deleteAdminRow, errorMessage, isAuthError, setAdminPublished } from '@/admin/adminApi';
import { ConfirmDialog, Modal, Notice, primaryButtonClass, secondaryButtonClass } from '@/admin/adminUi';
import { useAdminRows } from '@/admin/useAdminRows';

export interface ManagedRow {
  id: string;
  is_published: boolean;
  is_featured: boolean;
}

export interface FormProps<T> {
  initial: T | null;
  onAuthLost: () => void;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}

interface ContentManagerProps<T extends ManagedRow> {
  table: AdminTable;
  noun: string;
  newLabel: string;
  emptyText: string;
  describe: (row: T) => { title: string; subtitle: string; thumbnail: string | null };
  Form: ComponentType<FormProps<T>>;
  onAuthLost: () => void;
  onChanged: () => Promise<void>;
}

export default function ContentManager<T extends ManagedRow>({ table, noun, newLabel, emptyText, describe, Form, onAuthLost, onChanged }: ContentManagerProps<T>) {
  const { rows, loading, error, reload, setError } = useAdminRows<T>(table, onAuthLost);
  const [editing, setEditing] = useState<T | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<T | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function handleSaved() {
    setEditing(null);
    await reload();
    await onChanged();
  }

  async function togglePublished(row: T) {
    setBusyId(row.id);
    setError('');
    try {
      await setAdminPublished(table, row.id, !row.is_published);
      await reload();
      await onChanged();
    } catch (err) {
      if (isAuthError(err)) onAuthLost();
      else setError(errorMessage(err, 'Could not change visibility. Please try again.'));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setError('');
    try {
      await deleteAdminRow(table, deleting.id);
      setDeleting(null);
      await reload();
      await onChanged();
    } catch (err) {
      setDeleting(null);
      if (isAuthError(err)) onAuthLost();
      else setError(errorMessage(err, 'Could not delete this item. Please try again.'));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm font-semibold text-[#77736a]">{rows.length} {rows.length === 1 ? noun : `${noun}s`} in total</p>
        <button onClick={() => setEditing('new')} className={primaryButtonClass}>
          <Plus size={15} className="mr-1 inline" />{newLabel}
        </button>
      </div>

      {error && <Notice>{error}</Notice>}

      {loading ? (
        <div className="flex justify-center py-16 text-[#77736a]"><Loader2 className="animate-spin" size={26} /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-[#cfcac0] p-8 text-center text-sm text-[#77736a]">{emptyText}</div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const view = describe(row);
            const busy = busyId === row.id;
            return (
              <li key={row.id} className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#171717]">
                    {view.thumbnail ? <img src={view.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" /> : <ImageIcon className="m-5 text-[#f4d500]" size={24} />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold">{view.title}</p>
                    <p className="truncate text-sm text-[#77736a]">{view.subtitle}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.is_published ? 'bg-[#dff5e3] text-[#1d5c2b]' : 'bg-[#ece9e1] text-[#5c5953]'}`}>{row.is_published ? 'Published' : 'Draft'}</span>
                      {row.is_featured && <span className="rounded-full bg-[#f4d500] px-2.5 py-1 text-xs font-bold text-[#171717]">Featured</span>}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => setEditing(row)} disabled={busy} className={secondaryButtonClass} aria-label={`Edit ${view.title}`}><Pencil size={14} className="mr-1 inline" />Edit</button>
                  <button onClick={() => void togglePublished(row)} disabled={busy} className={secondaryButtonClass} aria-label={row.is_published ? `Unpublish ${view.title}` : `Publish ${view.title}`}>
                    {busy ? <Loader2 className="inline animate-spin" size={14} /> : row.is_published ? <EyeOff size={14} className="mr-1 inline" /> : <Eye size={14} className="mr-1 inline" />}
                    {row.is_published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button onClick={() => setDeleting(row)} disabled={busy} className="rounded-full border border-[#f1c2bb] bg-white px-4 py-2 text-sm font-bold text-[#b3261e] transition hover:bg-[#ffe2dc] disabled:opacity-50" aria-label={`Delete ${view.title}`}><Trash2 size={14} className="mr-1 inline" />Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <Modal title={editing === 'new' ? `New ${noun}` : `Edit ${noun}`} onClose={() => setEditing(null)}>
          <Form initial={editing === 'new' ? null : editing} onAuthLost={onAuthLost} onSaved={handleSaved} onCancel={() => setEditing(null)} />
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete this ${noun}?`}
          message={`"${describe(deleting).title}" will be removed from the admin list and the public site. Its uploaded files are removed too if nothing else uses them. This cannot be undone.`}
          confirmLabel={`Delete ${noun}`}
          busy={deleteBusy}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
