import { useEffect } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './engine/db';
import Today from './features/today/Today';
import Library from './features/library/Library';
import UnitCover from './features/library/UnitCover';
import ImportPack from './features/library/ImportPack';
import StudioHome from './features/studio/StudioHome';
import StudioSession from './features/studio/StudioSession';
import ThenVsNow from './features/studio/ThenVsNow';
import LabHome from './features/phonetique/LabHome';
import Lesson from './features/phonetique/Lesson';
import PairDrill from './features/phonetique/PairDrill';
import Speller from './features/phonetique/Speller';
import VocabHome from './features/vocab/VocabHome';
import Review from './features/vocab/Review';
import AddCard from './features/vocab/AddCard';
import Settings from './features/settings/Settings';
import GrammarCard from './features/library/GrammarCard';
import { Icon, type IconName } from './ui/icons';
import { ErrorBoundary } from './ui/ErrorBoundary';

function useTheme() {
  const theme = useLiveQuery(async () => ((await db.settings.get('theme'))?.value as string) ?? 'auto', []);
  useEffect(() => {
    const root = document.documentElement;
    if (!theme || theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    const dark = theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#17141B' : '#F6F1E7'));
  }, [theme]);
}

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Hôm nay', icon: 'today' },
  { to: '/studio', label: 'Studio', icon: 'studio' },
  { to: '/lab', label: 'Phonétique', icon: 'phonetique' },
  { to: '/cards', label: 'Từ vựng', icon: 'cards' },
  { to: '/library', label: 'Sách', icon: 'book' },
];

function BottomNav() {
  const loc = useLocation();
  // Full-screen practice views hide the tab bar to keep thumbs on the controls.
  if (/^\/(studio\/.+|cards\/review|lab\/(pairs|spell))/.test(loc.pathname)) return null;
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-[var(--rule)]" style={{ background: 'var(--paper)' }}>
      <div className="mx-auto grid max-w-[600px] grid-cols-5 px-2">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'}
            className={({ isActive }) => `flex min-h-[56px] flex-col items-center justify-center gap-1.5 transition-colors duration-300 ${isActive ? 'text-accent' : 'text-muted'}`}>
            <Icon name={t.icon} size={21} />
            <span className="text-[9.5px] font-medium uppercase tracking-[0.12em]">{t.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/** New screen, new page: start at the top (hash routing would otherwise keep the old scroll). */
function useScrollTop() {
  const loc = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
}

export default function App() {
  useTheme();
  useScrollTop();
  const loc = useLocation();
  return (
    <>
      <ErrorBoundary resetKey={loc.pathname}>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/library" element={<Library />} />
        <Route path="/import" element={<ImportPack />} />
        <Route path="/unit/:unitId" element={<UnitCover />} />
        <Route path="/unit/:unitId/grammar/:gid" element={<GrammarCard />} />
        <Route path="/studio" element={<StudioHome />} />
        <Route path="/studio/:unitId/:docId" element={<StudioSession />} />
        <Route path="/then-now" element={<ThenVsNow />} />
        <Route path="/lab" element={<LabHome />} />
        <Route path="/lab/lesson/:lessonId" element={<Lesson />} />
        <Route path="/lab/pairs/:lessonId" element={<PairDrill />} />
        <Route path="/lab/spell" element={<Speller />} />
        <Route path="/cards" element={<VocabHome />} />
        <Route path="/cards/review" element={<Review />} />
        <Route path="/cards/add" element={<AddCard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
      </ErrorBoundary>
      <BottomNav />
    </>
  );
}
