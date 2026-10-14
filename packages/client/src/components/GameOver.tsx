import type { GameView } from '@lw/engine';
import { DEATH_CAUSE_TEXT } from '@lw/engine';
import { roleEmoji, roleName, TEAM_LABEL } from '../lib/roles.ts';

export function GameOver({ view }: { view: GameView }) {
  const w = view.winner;
  const myTeam = view.reveal?.find((r) => r.seat === view.me?.seat)?.team;
  const won = w && myTeam === w.faction;
  return (
    <div className="space-y-4">
      <div className={`card text-center ${w?.faction === 'wolf' ? 'bg-rose-900/40' : w?.faction === 'good' ? 'bg-emerald-900/40' : ''}`}>
        <div className="text-5xl">{w?.faction === 'wolf' ? '🐺' : w?.faction === 'good' ? '🌞' : w?.faction === 'third' ? '💘' : '🏁'}</div>
        <div className="mt-2 text-2xl font-bold">{w?.text}</div>
        {view.me && w?.faction !== 'aborted' && <div className={`mt-1 ${won ? 'text-emerald-300' : 'text-slate-400'}`}>{won ? '你获胜了！' : '你输了'}</div>}
      </div>
      <div className="card">
        <div className="mb-2 font-semibold">身份揭晓</div>
        <div className="divide-y divide-white/5">
          {view.reveal?.map((r) => {
            const p = view.players.find((x) => x.seat === r.seat)!;
            return (
              <div key={r.seat} className="flex items-center gap-2 py-2 text-sm">
                <span className="w-8 font-bold">{r.seat}</span>
                <span className="flex-1 truncate">{p.name}</span>
                <span>{roleEmoji(r.role)} {roleName(r.role)}{r.initialRole !== r.role ? `（原${roleName(r.initialRole)}）` : ''}</span>
                <span className="w-16 text-right text-xs text-slate-400">{TEAM_LABEL[r.team]}</span>
                <span className={`w-20 text-right text-xs ${r.alive ? 'text-emerald-300' : 'text-slate-500'}`}>
                  {r.alive ? '存活' : DEATH_CAUSE_TEXT[r.deathCause as keyof typeof DEATH_CAUSE_TEXT] ?? '出局'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
