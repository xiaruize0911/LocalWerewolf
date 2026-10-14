import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Page } from '../components/ui.tsx';
import { api } from '../lib/api.ts';
import { disconnectSocket, emit } from '../lib/socket.ts';
import { useStore } from '../lib/store.ts';

interface MyRoom { code: string; hostName: string; presetName: string; started: boolean; over: boolean; seat: number | null; isHost: boolean }

export default function Home() {
  const user = useStore((s) => s.user)!;
  const connected = useStore((s) => s.connected);
  const setUser = useStore((s) => s.setUser);
  const [code, setCode] = useState('');
  const [rooms, setRooms] = useState<MyRoom[]>([]);
  const nav = useNavigate();

  useEffect(() => {
    if (connected) emit('rooms:mine').then((r) => setRooms(r.rooms)).catch(() => {});
  }, [connected]);

  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    disconnectSocket();
    setUser(null);
  };

  return (
    <Page>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-400">欢迎回来</div>
          <div className="text-2xl font-bold">{user.displayName}{user.isAdmin && <span className="chip ml-2 bg-amber-400/20 align-middle text-amber-200">管理员</span>}</div>
        </div>
        <div className="text-4xl">🐺</div>
      </div>

      <div className="grid gap-3">
        <Link to="/create" className="btn-primary py-4 text-lg">＋ 创建房间</Link>
        <form className="card flex gap-2" onSubmit={(e) => { e.preventDefault(); if (code) nav(`/room/${code}`); }}>
          <input className="input flex-1 text-center text-xl tracking-[0.4em]" inputMode="numeric" maxLength={4} placeholder="房间号" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          <button className="btn-amber" disabled={code.length !== 4}>加入</button>
        </form>
      </div>

      {rooms.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm text-slate-400">我的房间</h2>
          <div className="grid gap-2">
            {rooms.map((r) => (
              <Link key={r.code} to={`/room/${r.code}`} className="card flex items-center justify-between py-3">
                <div>
                  <div className="font-semibold">房间 {r.code} · {r.presetName}</div>
                  <div className="text-xs text-slate-400">房主 {r.hostName}{r.seat ? ` · 我在 ${r.seat}号` : ''}</div>
                </div>
                <span className={`chip ${r.started && !r.over ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/10'}`}>{r.over ? '已结束' : r.started ? '进行中' : '等待中'}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link to="/roles" className="card text-center hover:bg-night-700"><div className="text-2xl">📖</div><div className="mt-1">角色介绍</div></Link>
        <Link to="/boards" className="card text-center hover:bg-night-700"><div className="text-2xl">🧩</div><div className="mt-1">板子介绍</div></Link>
        <Link to="/stats" className="card text-center hover:bg-night-700"><div className="text-2xl">🏆</div><div className="mt-1">我的战绩</div></Link>
        <Link to="/history" className="card text-center hover:bg-night-700"><div className="text-2xl">📜</div><div className="mt-1">历史对局</div></Link>
        {user.isAdmin && <Link to="/admin" className="card col-span-2 text-center hover:bg-night-700"><div className="text-2xl">🛠️</div><div className="mt-1">管理后台</div></Link>}
      </div>
      <div className="mt-6 flex justify-center gap-4 text-sm text-slate-400">
        <Link to="/me">账号设置</Link>
        <button onClick={logout}>退出登录</button>
      </div>
    </Page>
  );
}
