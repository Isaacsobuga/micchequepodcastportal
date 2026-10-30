import { useRef, useState, type DragEvent } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { errorMessage, isAuthError, type UploadKind, uploadAdminMedia } from '@/admin/adminApi';
import { Notice, secondaryButtonClass } from '@/admin/adminUi';

const MB = 1024 * 1024;

const RULES = {
  image: { types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], maxBytes: 10 * MB, label: 'JPG, PNG, WebP or GIF up to 10 MB' },
  video: { types: ['video/mp4', 'video/webm'], maxBytes: 50 * MB, label: 'MP4 or WebM up to 50 MB' },
} as const;

interface MediaUploaderProps {
  label: string;
  hint?: string;
  kind: UploadKind;
  mediaType: 'image' | 'video';
  value: string | null;
  onChange: (url: string | null) => void;
  onAuthLost: () => void;
  onBusyChange: (busy: boolean) => void;
}

export default function MediaUploader({ label, hint, kind, mediaType, value, onChange, onAuthLost, onBusyChange }: MediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const rules = RULES[mediaType];
  const uploading = progress !== null;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!(rules.types as readonly string[]).includes(file.type)) {
      setError(`That file type is not supported. Use ${rules.label}.`);
      return;
    }
    if (file.size > rules.maxBytes) {
      setError(`That file is too large. Use ${rules.label}.`);
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setError('');
    setLocalPreview(previewUrl);
    setProgress(0);
    onBusyChange(true);
    try {
      onChange(await uploadAdminMedia(kind, file, setProgress));
    } catch (err) {
      if (isAuthError(err)) onAuthLost();
      else setError(errorMessage(err, 'Upload failed. Please try again.'));
    } finally {
      URL.revokeObjectURL(previewUrl);
      setLocalPreview(null);
      setProgress(null);
      onBusyChange(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (!uploading) void handleFile(event.dataTransfer.files[0]);
  }

  const shown = localPreview ?? value;
  const previewIsVideo = mediaType === 'video';

  return (
    <div>
      <p className="text-sm font-bold">{label}</p>
      {hint && <p className="mt-1 text-xs text-[#77736a]">{hint}</p>}
      <div
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`mt-2 overflow-hidden rounded-2xl border-2 border-dashed bg-white transition ${dragging ? 'border-[#171717] bg-[#fff8c2]' : 'border-[#d9d5ca]'}`}
      >
        {shown ? (
          previewIsVideo ? (
            <video src={shown} controls preload="metadata" className="aspect-video w-full bg-black" />
          ) : (
            <img src={shown} alt="" className={`aspect-video w-full object-cover ${uploading ? 'opacity-60' : ''}`} />
          )
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center gap-2 p-6 text-center text-sm text-[#77736a]">
            <Upload size={22} />
            <span>Drop a file here or choose one</span>
            <span className="text-xs">{rules.label}</span>
          </div>
        )}
        {uploading && (
          <div className="border-t border-[#ece9e1] p-3">
            <div className="h-2 overflow-hidden rounded-full bg-[#ece9e1]">
              <div className="h-full bg-[#f4d500] transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 flex items-center gap-2 text-xs font-bold"><Loader2 className="animate-spin" size={13} />Uploading {progress}%</p>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept={rules.types.join(',')} className="hidden" onChange={(event) => void handleFile(event.target.files?.[0])} />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className={secondaryButtonClass}>{value ? 'Replace file' : 'Choose file'}</button>
        {value && <button type="button" onClick={() => onChange(null)} disabled={uploading} className={secondaryButtonClass}>Remove</button>}
      </div>
      {error && <div className="mt-3"><Notice>{error}</Notice></div>}
    </div>
  );
}
