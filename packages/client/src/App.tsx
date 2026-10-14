import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toasts } from './components/ui.tsx';
import { api } from './lib/api.ts';
import { connectSocket } from './lib/socket.ts';
import './lib/voice.ts';
import { useStore } from './lib/store.ts';
import Admin from './pages/Admin.tsx';
import Config from './pages/Config.tsx';
import Display from './pages/Display.tsx';
import Home from './pages/Home.tsx';
import Login from './pages/Login.tsx';
import Room from './pages/Room.tsx';
import { BoardsPage, RoleDetailPage, RolesPage } from './pages/Roles.tsx';
import { GameDetailPage, HistoryPage, ProfilePage, StatsPage } from './pages/Stats.tsx';

function RequireAuth({ children }: { children: ReactNode }) {
  const user = useStore((s) => s.user);
  const loaded = useStore((s) => s.userLoaded);
  const loc = useLocation();
  if (!loaded) return <div className="p-10 text-center text-slate-400">加载中…</div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <>{children}</>;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export default function App() {
  const setUser = useStore((s) => s.setUser);
  useEffect(() => {
    api('/api/me')
      .then((r) => {
        setUser(r.user);
        connectSocket();
      })
      .catch(() => setUser(null));
  }, []);

  const auth = (el: ReactNode) => <RequireAuth>{el}</RequireAuth>;
  return (
    <>
      <Toasts />
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/roles" element={<RolesPage />} />
        <Route path="/roles/:id" element={<RoleDetailPage />} />
        <Route path="/boards" element={<BoardsPage />} />
        <Route path="/" element={auth(<Home />)} />
        <Route path="/create" element={auth(<Config />)} />
        <Route path="/room/:code" element={auth(<Room />)} />
        <Route path="/room/:code/config" element={auth(<Config />)} />
        <Route path="/display/:code" element={auth(<Display />)} />
        <Route path="/stats" element={auth(<StatsPage />)} />
        <Route path="/history" element={auth(<HistoryPage />)} />
        <Route path="/games/:id" element={auth(<GameDetailPage />)} />
        <Route path="/me" element={auth(<ProfilePage />)} />
        <Route path="/admin" element={auth(<Admin />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
