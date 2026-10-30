import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Loader2, LogOut, Play, RefreshCw, ShoppingBag } from 'lucide-react';
import { AdminApiError, clearAdminToken, getAdminToken, logoutAdmin, verifyAdminSession } from '@/admin/adminApi';
import AdminLogin from '@/admin/AdminLogin';
import EventsManager from '@/admin/EventsManager';
import EpisodesManager from '@/admin/EpisodesManager';
import MerchManager from '@/admin/MerchManager';
import { primaryButtonClass, secondaryButtonClass } from '@/admin/adminUi';

type Tab = 'overview' | 'events' | 'episodes' | 'merch';
type Gate = 'checking' | 'locked' | 'open' | 'offline';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'events', label: 'Events' },
  { id: 'episodes', label: 'Episodes' },
  { id: 'merch', label: 'Merchandise' },
];

const SESSION_ENDED = 'Your admin session has ended. Please sign in again.';

interface AdminPageProps {
  onExit: () => void;
  onContentChanged: () => Promise<void>;
}

export default function AdminPage({ onExit, onContentChanged }: AdminPageProps) {
  const [gate, setGate] = useState<Gate>('checking');
  const [tab, setTab] = useState<Tab>('overview');
  const [notice, setNotice] = useState('');

  const lockOut = useCallback((message: string) => {
    clearAdminToken();
    setNotice(message);
    setGate('locked');
  }, []);

  const handleAuthLost = useCallback(() => lockOut(SESSION_ENDED), [lockOut]);

  const checkSession = useCallback(async () => {
    if (!getAdminToken()) {
      setGate('locked');
      return;
    }
    setGate('checking');
    try {
      await verifyAdminSession();
      setGate('open');
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 401) lockOut(SESSION_ENDED);
      else setGate('offline');
    }
  }, [lockOut]);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  async function signOut() {
    await logoutAdmin().catch(() => undefined);
    setNotice('');
    setGate('locked');
  }

  if (gate === 'checking') {
    return <div className="flex min-h-screen items-center justify-center bg-[#171717] text-[#f4d500]"><Loader2 className="animate-spin" size={28} /></div>;
  }

  if (gate === 'offline') {
    return (
      <div className="flex min-h-screen flex-col bg-[#171717] p-6 text-white">
        <button onClick={onExit} className="self-start text-sm underline">Back to public site</button>
        <div className="flex flex-1 items-center justify-center">
          <div className="max-w-md rounded-[2rem] bg-white/10 p-8 text-center">
            <h1 className="display text-5xl font-bold uppercase">Can’t reach the control room</h1>
            <p className="mt-3 text-sm leading-6 text-[#c4c0b7]">The server didn’t respond, so nothing was changed. Your session is still saved on this device.</p>
            <button onClick={() => void checkSession()} className={`${primaryButtonClass} mt-6`}><RefreshCw size={15} className="mr-1 inline" />Try again</button>
          </div>
        </div>
      </div>
    );
  }

  if (gate === 'locked') {
    return <AdminLogin notice={notice} onSuccess={() => { setNotice(''); setGate('open'); }} onExit={onExit} />;
  }

  return (
    <div className="min-h-screen bg-[#f5f3ed] p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#77736a]">Mic Cheque × Tapp</p>
            <h1 className="display text-5xl font-bold uppercase leading-none">Control room</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={onExit} className={secondaryButtonClass}>View public site</button>
            <button onClick={() => void signOut()} className={`${primaryButtonClass} flex items-center gap-2`}><LogOut size={14} />Sign out</button>
          </div>
        </header>

        <div className="mt-8 grid gap-4 lg:grid-cols-[220px_1fr]">
          <nav className="flex gap-2 overflow-x-auto rounded-[1.5rem] bg-[#171717] p-3 text-white lg:flex-col lg:overflow-visible">
            {TABS.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`whitespace-nowrap rounded-xl px-3 py-3 text-left text-sm font-bold transition ${tab === item.id ? 'bg-[#f4d500] text-[#171717]' : 'hover:bg-white/10'}`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <section className="min-w-0 rounded-[1.5rem] bg-white p-5 sm:p-8">
            {tab === 'overview' && <Overview onOpen={setTab} />}
            {tab === 'events' && <EventsManager onAuthLost={handleAuthLost} onChanged={onContentChanged} />}
            {tab === 'episodes' && <EpisodesManager onAuthLost={handleAuthLost} onChanged={onContentChanged} />}
            {tab === 'merch' && <MerchManager onAuthLost={handleAuthLost} onChanged={onContentChanged} />}
          </section>
        </div>
      </div>
    </div>
  );
}

function Overview({ onOpen }: { onOpen: (tab: Tab) => void }) {
  const cards: { tab: Tab; title: string; text: string; icon: typeof CalendarDays; className: string }[] = [
    { tab: 'events', title: 'Events', text: 'Posters, videos, dates and tickets links.', icon: CalendarDays, className: 'bg-[#f4d500]' },
    { tab: 'episodes', title: 'Episodes', text: 'YouTube episodes with automatic thumbnails.', icon: Play, className: 'bg-[#dedbd2]' },
    { tab: 'merch', title: 'Merchandise', text: 'Products that link to the official shop.', icon: ShoppingBag, className: 'bg-[#171717] text-white' },
  ];
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-[#77736a]">Publishing workspace</p>
      <h2 className="display mt-2 text-5xl font-bold uppercase leading-none">Keep the signal fresh</h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[#5c5953]">Changes you publish appear on the public site straight away. Drafts stay hidden until you publish them.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {cards.map(({ tab, title, text, icon: Icon, className }) => (
          <button key={tab} onClick={() => onOpen(tab)} className={`rounded-2xl p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${className}`}>
            <Icon size={22} />
            <p className="display mt-8 text-3xl font-bold uppercase">{title}</p>
            <p className="mt-1 text-sm opacity-80">{text}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
