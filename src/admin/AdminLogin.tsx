import { useState, type FormEvent } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { errorMessage, loginAdmin } from '@/admin/adminApi';
import { Notice, inputClass, primaryButtonClass } from '@/admin/adminUi';

interface AdminLoginProps {
  notice: string;
  onSuccess: () => void;
  onExit: () => void;
}

export default function AdminLogin({ notice, onSuccess, onExit }: AdminLoginProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await loginAdmin(password);
      setPassword('');
      onSuccess();
    } catch (err) {
      setError(errorMessage(err, 'Sign in failed. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#171717] p-6 text-white">
      <button onClick={onExit} className="self-start text-sm underline">Back to public site</button>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-md rounded-[2rem] bg-white/10 p-8 shadow-2xl">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f4d500] text-[#171717]"><Lock size={24} /></div>
          <h1 className="display mt-6 text-5xl font-bold uppercase leading-none">Control room</h1>
          <p className="mt-3 text-sm leading-6 text-[#c4c0b7]">Enter the admin password to manage events, episodes and merchandise.</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <label className="block text-sm font-bold">
              Admin password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={`${inputClass} text-[#171717]`}
              />
            </label>
            <button disabled={busy} className={`${primaryButtonClass} flex w-full items-center justify-center gap-2`}>
              {busy && <Loader2 className="animate-spin" size={16} />}
              {busy ? 'Checking...' : 'Unlock control room'}
            </button>
          </form>
          {(error || notice) && <div className="mt-4"><Notice>{error || notice}</Notice></div>}
        </div>
      </div>
    </div>
  );
}
