import type { GameView } from '@lw/engine';
import { useState } from 'react';

export function Logs({ view, privateInfo = true }: { view: GameView; privateInfo?: boolean }) {
  const [tab, setTab] = useState<'mine' | 'public' | 'votes'>('public');
  const tabs = [
    ...(privateInfo && view.me ? [['mine', '我的信息'] as const] : []),
    ['public', '公共记录'] as const,
    ['votes', `投票（${view.votes.length}）`] as const,
  ];
  return (
    <div className="card">
      <div className="mb-3 flex gap-1 rounded-xl bg-white/5 p-1 text-sm">
        {tabs.map(([k, l]) => (
          <button key={k} className={`flex-1 rounded-lg py-1.5 ${tab === k ? 'bg-night-600' : 'text-slate-400'}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <div className="max-h-72 space-y-1 overflow-y-auto text-sm">
        {tab === 'mine' && (view.me!.info.length ? [...view.me!.info].reverse().map((x, i) => <div key={i} className="rounded-lg bg-indigo-500/10 px-2 py-1">{x.text}</div>) : <div className="text-slate-500">暂无</div>)}
        {tab === 'public' && [...view.log].reverse().map((l) => (
          <div key={l.id} className={l.text.startsWith('——') ? 'pt-2 text-center text-xs text-slate-500' : 'px-1'}>{l.text}</div>
        ))}
        {tab === 'votes' && (view.votes.length ? [...view.votes].reverse().map((v, i) => (
          <div key={i} className="rounded-lg bg-white/5 p-2">
            <div className="font-medium">{v.title}</div>
            <div className="text-xs text-slate-400">{v.tally.map((t) => `${t.seat}号 ${t.score}票`).join('，') || '全部弃票'}</div>
            {v.ballots.length > 0 && <div className="mt-1 text-xs text-slate-500">{v.ballots.map((b) => `${b.voter}→${b.target ?? '弃'}`).join('  ')}</div>}
            <div className="mt-1 text-xs text-amber-200">{v.result}</div>
          </div>
        )) : <div className="text-slate-500">暂无</div>)}
      </div>
    </div>
  );
}
