import { boardSize, validateBoard, type Board } from '@lw/engine';
import { Link } from 'react-router-dom';
import { CATEGORY_LABEL, roleEmoji, rolesByCategory } from '../lib/roles.ts';

export function playerCountOf(board: Board) {
  return boardSize(board) - ((board.thief ?? 0) > 0 ? 2 : 0);
}

export function BoardEditor({ board, onChange }: { board: Board; onChange: (b: Board) => void }) {
  const set = (id: string, n: number) => {
    const next = { ...board, [id]: Math.max(0, Math.min(id === 'thief' || id === 'cupid' ? 1 : 12, n)) };
    if (!next[id]) delete next[id];
    onChange(next);
  };
  const players = playerCountOf(board);
  const err = validateBoard(board, players);
  return (
    <div className="space-y-3">
      <div className="card flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-400">人数</div>
          <div className="text-2xl font-bold">{players} 人{board.thief ? <span className="ml-2 text-sm font-normal text-slate-400">（共 {boardSize(board)} 张牌，含 2 张盗贼底牌）</span> : null}</div>
        </div>
        <div className={`text-right text-sm ${err ? 'text-rose-300' : 'text-emerald-300'}`}>{err ?? '配板有效 ✓'}</div>
      </div>
      {rolesByCategory().map(([cat, roles]) => (
        <div key={cat} className="card">
          <div className="mb-2 font-semibold">{CATEGORY_LABEL[cat]}</div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {roles.map((r) => {
              const n = board[r.id] ?? 0;
              return (
                <div key={r.id} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${n ? 'bg-white/10' : 'bg-white/[0.03]'}`}>
                  <span className="text-xl">{roleEmoji(r.id)}</span>
                  <Link to={`/roles/${r.id}`} className="min-w-0 flex-1 truncate text-sm hover:underline" title={r.short}>{r.name}</Link>
                  <button className="btn-ghost size-8 p-0" onClick={() => set(r.id, n - 1)} disabled={!n}>−</button>
                  <span className="w-5 text-center tabular-nums">{n}</span>
                  <button className="btn-ghost size-8 p-0" onClick={() => set(r.id, n + 1)}>+</button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
