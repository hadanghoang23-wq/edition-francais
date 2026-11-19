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
import PracticeHub from './features/practice/PracticeHub';
import { ExercisePage, GroupExercises } from './features/exercises/ExercisePages';
import { Dictee, GapListen, ListenTracks } from './features/listen/Listening';
import { Reader, ReadHome } from './features/read/Reading';
import { AgreementTrainer, ArticleTrainer, ErrorLog, VerbTrainer } from './features/grammar/Trainers';
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
  { to: '/practice', label: 'Luyện tập', icon: 'phonetique' },
  { to: '/cards', label: 'Từ vựng', icon: 'cards' },
  { to: '/library', label: 'Sách', icon: 'book' },
];

function BottomNav() {
  const loc = useLocation();
  // Full-screen practice views hide the tab bar to keep thumbs on the controls.
  if (/^\/(studio\/.+|cards\/review|lab\/(pairs|spell)|practice\/((dictee|gaps)\/.+|verbs|articles|agreement))/.test(loc.pathname)) return null;
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-[var(--rule)]" style={{ background: 'var(--paper)' }}>
      <div className="mx-auto grid max-w-[600px] grid-cols-5 px-2">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'}
            className={({ isActive }) => `${isActive || (t.to === '/practice' && loc.pathname.startsWith('/lab')) ? 'text-accent' : 'text-muted'} flex min-h-[56px] flex-col items-center justify-center gap-1.5 transition-colors duration-300`}>
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
        <Route path="/practice" element={<PracticeHub />} />
        <Route path="/practice/errors" element={<ErrorLog />} />
        <Route path="/practice/verbs" element={<VerbTrainer />} />
        <Route path="/practice/articles" element={<ArticleTrainer />} />
        <Route path="/practice/agreement" element={<AgreementTrainer />} />
        <Route path="/practice/dictee" element={<ListenTracks mode="dictee" />} />
        <Route path="/practice/dictee/:trackId" element={<Dictee />} />
        <Route path="/practice/gaps" element={<ListenTracks mode="gaps" />} />
        <Route path="/practice/gaps/:trackId" element={<GapListen />} />
        <Route path="/practice/read" element={<ReadHome />} />
        <Route path="/practice/read/:unitId/:docId" element={<Reader />} />
        <Route path="/practice/ex/:group" element={<GroupExercises />} />
        <Route path="/practice/:group/:unitId/:exId" element={<ExercisePage />} />
      </Routes>
      </ErrorBoundary>
      <BottomNav />
    </>
  );
}
