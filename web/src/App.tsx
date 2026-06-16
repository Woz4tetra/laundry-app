import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useStore } from './lib/store';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Sort } from './pages/Sort';
import { BuildLoads } from './pages/BuildLoads';
import { RunLoad } from './pages/RunLoad';
import { Overview } from './pages/Overview';
import { DryerCalc } from './pages/DryerCalc';
import { Rules } from './pages/Rules';
import { BottomNav } from './components/BottomNav';

export default function App() {
  const { ready, authed } = useStore();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-4xl">
        <span className="animate-spin">🧺</span>
      </div>
    );
  }

  if (!authed) return <Login />;

  const hideNav = location.pathname.startsWith('/run/');

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col">
      <main className="flex-1 overflow-y-auto px-4 pb-28 pt-2">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sort" element={<Sort />} />
          <Route path="/build" element={<BuildLoads />} />
          <Route path="/run/:loadId" element={<RunLoad />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/dryer" element={<DryerCalc />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
