import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

export const inputClass = 'mt-2 w-full rounded-xl border border-[#d9d5ca] bg-white px-4 py-3 text-sm font-normal outline-none transition focus:border-[#171717]';
export const primaryButtonClass = 'rounded-full bg-[#171717] px-6 py-3 text-sm font-bold text-[#f4d500] transition hover:bg-[#333] disabled:cursor-not-allowed disabled:opacity-50';
export const secondaryButtonClass = 'rounded-full border border-[#d9d5ca] bg-white px-4 py-2 text-sm font-bold transition hover:border-[#171717] disabled:cursor-not-allowed disabled:opacity-50';
export const dangerButtonClass = 'rounded-full bg-[#b3261e] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#8e1d17] disabled:cursor-not-allowed disabled:opacity-50';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="animate-rise max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-[#f5f3ed] p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 className="display text-4xl font-bold uppercase leading-none">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 transition hover:bg-black/5"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel, busy, onConfirm, onCancel }: { title: string; message: string; confirmLabel: string; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm leading-6 text-[#5c5953]">{message}</p>
      <div className="mt-8 flex justify-end gap-3">
        <button onClick={onCancel} disabled={busy} className={secondaryButtonClass}>Cancel</button>
        <button onClick={onConfirm} disabled={busy} className={dangerButtonClass}>{busy ? 'Working...' : confirmLabel}</button>
      </div>
    </Modal>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-bold">
      {label}
      {children}
      {hint && <span className="mt-1 block text-xs font-normal text-[#77736a]">{hint}</span>}
    </label>
  );
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-bold">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[#171717]" />
      {label}
    </label>
  );
}

export function Notice({ tone = 'error', children }: { tone?: 'error' | 'info'; children: ReactNode }) {
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl p-3 text-sm font-semibold ${tone === 'error' ? 'bg-[#ffe2dc] text-[#8e2d1f]' : 'bg-[#f4d500]/30 text-[#171717]'}`}>
      {children}
    </p>
  );
}
