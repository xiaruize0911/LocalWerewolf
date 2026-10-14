import { DEATH_CAUSE_TEXT } from '@lw/engine';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Empty, Page } from '../components/ui.tsx';
import { api } from '../lib/api.ts';
import { roleEmoji, roleName, TEAM_LABEL } from '../lib/roles.ts';
import { useStore } from '../lib/store.ts';

const pct = (w: number, g: number) => (g ? `${Math.round((w / g) * 100)}%` : '-');

export function StatsPage() {
  const [data, setData] = useState<any>(null);
  const [board, setBoard] = useState<any[]>([]);
  useEffect(() => {
    api('/api/stats/me').then(setData);
    api('/api/stats/leaderboard').then((r) => setBoard(r.rows));
  }, []);
  if (!data) return <Page title="我的战绩" back="/"><Empty>加载中…</Empty></Page>;
  const t = data.total;
  return (
    <Page title="我的战绩" back="/">
      <div className="grid grid-cols-3 gap-2">
        <div className="card text-center"><div className="text-3xl font-bold">{t.games}</div><div className="text-xs text-slate-400">总场次</div></div>
        <div className="card text-center"><div className="text-3xl font-bold">{t.wins}</div><div className="text-xs text-slate-400">胜场</div></div>
        <div className="card text-center"><div className="text-3xl font-bold">{pct(t.wins, t.games)}</div><div className="text-xs text-slate-400">胜率</div></div>
        <div className="card text-center"><div className="text-2xl font-bold">{t.survived}</div><div className="text-xs text-slate-400">存活到最后</div></div>
        <div className="card text-center"><div className="text-2xl font-bold">{t.sheriff}</div><div className="text-xs text-slate-400">当选警长</div></div>
        <Link to="/history" className="card text-center"><div className="text-2xl">📜</div><div className="text-xs text-slate-400">历史对局</div></Link>
      </div>
      <h2 className="mb-2 mt-6 font-semibold">按阵营</h2>
      <div className="card divide-y divide-white/5">
        {data.byTeam.length ? data.byTeam.map((r: any) => (
          <div key={r.team} className="flex justify-between py-2"><span>{TEAM_LABEL[r.team] ?? r.team}</span><span className="text-slate-300">{r.wins}/{r.games} · {pct(r.wins, r.games)}</span></div>
        )) : <Empty>还没有完成的对局</Empty>}
      </div>
      <h2 className="mb-2 mt-6 font-semibold">按身份</h2>
      <div className="card divide-y divide-white/5">
        {data.byRole.map((r: any) => (
          <div key={r.role} className="flex justify-between py-2"><span>{roleEmoji(r.role)} {roleName(r.role)}</span><span className="text-slate-300">{r.wins}/{r.games} · {pct(r.wins, r.games)}</span></div>
        ))}
      </div>
      <h2 className="mb-2 mt-6 font-semibold">排行榜</h2>
      <div className="card divide-y divide-white/5">
        {board.map((r, i) => (
          <div key={r.id} className="flex justify-between py-2"><span>{i + 1}. {r.name}</span><span className="text-slate-300">{r.wins} 胜 / {r.games} 场 · {pct(r.wins, r.games)}</span></div>
        ))}
        {!board.length && <Empty>暂无数据</Empty>}
      </div>
    </Page>
  );
}

export function HistoryPage() {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    api('/api/history').then((r) => setRows(r.rows));
  }, []);
  return (
    <Page title="历史对局" back="/">
      {!rows ? <Empty>加载中…</Empty> : !rows.length ? <Empty>还没有对局记录</Empty> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link key={r.id} to={r.endedAt ? `/games/${r.id}` : '#'} className="card flex items-center gap-3 py-3">
              <span className="text-3xl">{roleEmoji(r.initialRole)}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{r.presetName} · {roleName(r.initialRole)}{r.finalRole !== r.initialRole ? `→${roleName(r.finalRole)}` : ''}</div>
                <div className="text-xs text-slate-400">{new Date(r.startedAt).toLocaleString()} · {r.seat}号 · {r.days ?? '-'}天</div>
              </div>
              <span className={`chip ${!r.endedAt ? 'bg-white/10' : r.won ? 'bg-emerald-500/20 text-emerald-200' : 'bg-rose-500/20 text-rose-200'}`}>
                {!r.endedAt ? '未完成' : r.winner === 'aborted' ? '已终止' : r.won ? '胜利' : '失败'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Page>
  );
}

export function GameDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    api(`/api/games/${id}`).then(setData).catch((e) => setErr(e.message));
  }, [id]);
  if (err) return <Page title="对局复盘" back="/history"><Empty>{err}</Empty></Page>;
  if (!data) return <Page title="对局复盘" back="/history"><Empty>加载中…</Empty></Page>;
  const audience = (to: any) => (to === 'all' ? '' : Array.isArray(to) ? `[仅${to.join('、')}号可见] ` : '[狼队] ');
  return (
    <Page title={`${data.game.presetName} · 复盘`} back="/history">
      <div className="card mb-4 text-center">
        <div className="text-xl font-bold">{data.game.winnerText}</div>
        <div className="text-sm text-slate-400">{new Date(data.game.startedAt).toLocaleString()} · 共 {data.game.days} 天</div>
      </div>
      <div className="card mb-4 divide-y divide-white/5">
        {data.players.map((p: any) => (
          <div key={p.seat} className="flex items-center gap-2 py-2 text-sm">
            <span className="w-6 font-bold">{p.seat}</span>
            <span className="flex-1 truncate">{p.name}{p.isBot ? ' 🤖' : ''}{p.wasSheriff ? ' ⭐' : ''}</span>
            <span>{roleEmoji(p.finalRole)} {roleName(p.finalRole)}</span>
            <span className="w-16 text-right text-xs text-slate-400">{TEAM_LABEL[p.team]}</span>
            <span className={`w-24 text-right text-xs ${p.survived ? 'text-emerald-300' : 'text-slate-500'}`}>
              {p.survived ? '存活' : `第${p.deathDay}天 ${DEATH_CAUSE_TEXT[p.deathCause as keyof typeof DEATH_CAUSE_TEXT] ?? ''}`}
            </span>
          </div>
        ))}
      </div>
      <h2 className="mb-2 font-semibold">上帝视角记录</h2>
      <div className="card space-y-1 text-sm">
        {data.log.map((l: any) => (
          <div key={l.id} className={l.text.startsWith('——') ? 'pt-2 text-center text-xs text-slate-500' : l.to === 'all' ? '' : 'text-indigo-200'}>
            {audience(l.to)}{l.text}
          </div>
        ))}
      </div>
    </Page>
  );
}

export function ProfilePage() {
  const user = useStore((s) => s.user)!;
  const setUser = useStore((s) => s.setUser);
  const toast = useStore((s) => s.toast);
  const [name, setName] = useState(user.displayName);
  const [oldPassword, setOld] = useState('');
  const [newPassword, setNew] = useState('');
  const save = async (body: any) => {
    try {
      const r = await api('/api/me', { method: 'PATCH', body });
      setUser(r.user);
      toast('已保存', 'success');
      setOld('');
      setNew('');
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };
  return (
    <Page title="账号设置" back="/">
      <div className="card space-y-3">
        <div className="label">用户名：{user.username}</div>
        <div>
          <div className="label mb-1">昵称（游戏中显示）</div>
          <div className="flex gap-2"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /><button className="btn-primary" onClick={() => save({ displayName: name })}>保存</button></div>
        </div>
      </div>
      <div className="card mt-4 space-y-3">
        <div className="font-semibold">修改密码</div>
        <input className="input" type="password" placeholder="原密码" value={oldPassword} onChange={(e) => setOld(e.target.value)} />
        <input className="input" type="password" placeholder="新密码（至少 4 位）" value={newPassword} onChange={(e) => setNew(e.target.value)} />
        <button className="btn-primary w-full" disabled={!newPassword} onClick={() => save({ oldPassword, newPassword })}>修改密码</button>
      </div>
    </Page>
  );
}
