import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Empty, Modal, Page } from '../components/ui.tsx';
import { api } from '../lib/api.ts';
import { useStore } from '../lib/store.ts';

interface AdminUser { id: number; username: string; displayName: string; createdAt: number; isAdmin: number; games: number; wins: number }
interface AdminRoom { code: string; hostName: string; presetName: string; playerCount: number; seated: number; bots: number; online: number; status: string; updatedAt: number }
interface AdminGame { id: number; roomCode: string; presetName: string; startedAt: number; endedAt: number | null; winner: string | null; winnerText: string | null; days: number | null; players: string | null }

const fmt = (t: number) => new Date(t).toLocaleString();

function Users() {
  const me = useStore((s) => s.user)!;
  const toast = useStore((s) => s.toast);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [q, setQ] = useState('');
  const [pwFor, setPwFor] = useState<AdminUser | null>(null);
  const [pw, setPw] = useState('');
  const load = () => api('/api/admin/users').then((r) => setUsers(r.users));
  useEffect(() => void load(), []);

  const run = async (fn: () => Promise<any>, ok: string) => {
    try {
      await fn();
      toast(ok, 'success');
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  if (!users) return <Empty>加载中…</Empty>;
  const list = users.filter((u) => !q || u.username.includes(q) || u.displayName.includes(q));
  return (
    <>
      <input className="input mb-3" placeholder="搜索用户名或昵称" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="space-y-2">
        {list.map((u) => (
          <div key={u.id} className="card py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold">
                  {u.displayName} <span className="text-sm font-normal text-slate-400">@{u.username}</span>
                  {!!u.isAdmin && <span className="chip ml-1 bg-amber-400/20 text-amber-200">管理员</span>}
                  {u.id === me.id && <span className="chip ml-1 bg-white/10">我</span>}
                </div>
                <div className="text-xs text-slate-400">注册于 {fmt(u.createdAt)} · {u.games} 场 · {u.wins} 胜</div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              <button className="btn-ghost px-3 py-1.5" onClick={() => { setPwFor(u); setPw(''); }}>重置密码</button>
              <button className="btn-ghost px-3 py-1.5" disabled={u.id === me.id}
                onClick={() => run(() => api(`/api/admin/users/${u.id}`, { method: 'PATCH', body: { isAdmin: !u.isAdmin } }), u.isAdmin ? '已取消管理员' : '已设为管理员')}>
                {u.isAdmin ? '取消管理员' : '设为管理员'}
              </button>
              <button className="btn-ghost px-3 py-1.5 text-rose-300" disabled={u.id === me.id}
                onClick={() => window.confirm(`删除用户 ${u.username}？历史对局会保留但不再关联该账号。`) && run(() => api(`/api/admin/users/${u.id}`, { method: 'DELETE' }), '已删除')}>
                删除
              </button>
            </div>
          </div>
        ))}
        {!list.length && <Empty>没有匹配的用户</Empty>}
      </div>
      <Modal open={!!pwFor} onClose={() => setPwFor(null)} title={`重置 ${pwFor?.username} 的密码`}>
        <input className="input" type="password" placeholder="新密码（至少 4 位）" value={pw} onChange={(e) => setPw(e.target.value)} />
        <p className="mt-2 text-xs text-slate-400">重置后该用户在其他设备上需要重新登录。</p>
        <button className="btn-primary mt-3 w-full" disabled={pw.length < 4}
          onClick={() => { const u = pwFor!; setPwFor(null); run(() => api(`/api/admin/users/${u.id}`, { method: 'PATCH', body: { password: pw } }), '密码已重置'); }}>
          确认重置
        </button>
      </Modal>
    </>
  );
}

function Rooms() {
  const toast = useStore((s) => s.toast);
  const [rooms, setRooms] = useState<AdminRoom[] | null>(null);
  const load = () => api('/api/admin/rooms').then((r) => setRooms(r.rooms));
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);
  if (!rooms) return <Empty>加载中…</Empty>;
  if (!rooms.length) return <Empty>当前没有房间</Empty>;
  return (
    <div className="space-y-2">
      {rooms.map((r) => (
        <div key={r.code} className="card py-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">房间 {r.code} · {r.presetName}</div>
            <span className="chip bg-white/10">{r.status}</span>
          </div>
          <div className="text-xs text-slate-400">房主 {r.hostName} · 座位 {r.seated}/{r.playerCount}{r.bots ? `（机器人 ${r.bots}）` : ''} · 在线 {r.online} · 更新于 {fmt(r.updatedAt)}</div>
          <div className="mt-2 flex gap-2 text-sm">
            <Link to={`/room/${r.code}`} className="btn-ghost px-3 py-1.5">进入</Link>
            <Link to={`/display/${r.code}`} target="_blank" className="btn-ghost px-3 py-1.5">大屏</Link>
            <button className="btn-ghost px-3 py-1.5 text-rose-300" onClick={async () => {
              if (!window.confirm(`关闭房间 ${r.code}？进行中的游戏会被中止。`)) return;
              await api(`/api/admin/rooms/${r.code}/close`, { method: 'POST' });
              toast('房间已关闭', 'success');
              load();
            }}>关闭房间</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Games() {
  const toast = useStore((s) => s.toast);
  const [games, setGames] = useState<AdminGame[] | null>(null);
  const load = () => api('/api/admin/games').then((r) => setGames(r.games));
  useEffect(() => void load(), []);
  if (!games) return <Empty>加载中…</Empty>;
  if (!games.length) return <Empty>还没有对局</Empty>;
  return (
    <div className="space-y-2">
      {games.map((g) => (
        <div key={g.id} className="card flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">#{g.id} {g.presetName} · {g.winnerText ?? (g.endedAt ? '-' : '未完成')}</div>
            <div className="truncate text-xs text-slate-400">{fmt(g.startedAt)} · 房间 {g.roomCode} · {g.days ?? '-'} 天 · {g.players || '仅机器人'}</div>
          </div>
          {g.endedAt && <Link to={`/games/${g.id}`} className="btn-ghost px-3 py-1.5 text-sm">复盘</Link>}
          <button className="btn-ghost px-3 py-1.5 text-sm text-rose-300" onClick={async () => {
            if (!window.confirm(`删除对局 #${g.id}？相关战绩也会被移除。`)) return;
            await api(`/api/admin/games/${g.id}`, { method: 'DELETE' });
            toast('已删除', 'success');
            load();
          }}>删除</button>
        </div>
      ))}
    </div>
  );
}

export default function Admin() {
  const user = useStore((s) => s.user)!;
  const [tab, setTab] = useState<'users' | 'rooms' | 'games'>('users');
  const [sum, setSum] = useState<{ users: number; games: number; rooms: number; online: number } | null>(null);
  useEffect(() => {
    if (user.isAdmin) api('/api/admin/summary').then(setSum).catch(() => {});
  }, []);
  if (!user.isAdmin) return <Page title="管理后台" back="/"><Empty>需要管理员权限</Empty></Page>;
  return (
    <Page title="🛠️ 管理后台" back="/">
      {sum && (
        <div className="mb-4 grid grid-cols-4 gap-2 text-center">
          {([['用户', sum.users], ['对局', sum.games], ['房间', sum.rooms], ['在线', sum.online]] as const).map(([l, n]) => (
            <div key={l} className="card px-2 py-3"><div className="text-2xl font-bold">{n}</div><div className="text-xs text-slate-400">{l}</div></div>
          ))}
        </div>
      )}
      <div className="mb-4 grid grid-cols-3 rounded-xl bg-white/5 p-1 text-sm">
        {([['users', '用户'], ['rooms', '房间'], ['games', '对局']] as const).map(([k, l]) => (
          <button key={k} className={`rounded-lg py-2 ${tab === k ? 'bg-indigo-500 text-white' : 'text-slate-300'}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'users' ? <Users /> : tab === 'rooms' ? <Rooms /> : <Games />}
      <p className="mt-6 text-center text-xs text-slate-500">管理员在任何房间都拥有房主权限（开始、暂停、跳过发言、终止、关闭房间）。</p>
    </Page>
  );
}
