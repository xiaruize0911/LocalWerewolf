import type { Ctx } from './ctx.ts';
import type { DeathCause, Seat, Step } from './types.ts';

export interface Death {
  seat: Seat;
  cause: DeathCause;
}

/** 把连锁死亡（殉情、狼美人、摄梦人）补进列表 */
export function expandChain(ctx: Ctx, list: Death[], night: boolean): Death[] {
  const out = new Map<Seat, DeathCause>();
  const queue = [...list];
  while (queue.length) {
    const d = queue.shift()!;
    if (!ctx.alive(d.seat) || out.has(d.seat)) continue;
    out.set(d.seat, d.cause);
    const lovers: Seat[] | undefined = ctx.s.roleState.cupid?.lovers;
    if (lovers?.includes(d.seat)) {
      const other = lovers.find((s) => s !== d.seat);
      if (other != null) queue.push({ seat: other, cause: 'lover' });
    }
    const role = ctx.player(d.seat).role;
    if (role === 'wolfBeauty') {
      const charmed = ctx.s.roleState.wolfBeauty?.[d.seat];
      if (charmed != null) queue.push({ seat: charmed, cause: 'charm' });
    }
    if (night && role === 'dreamer' && ctx.s.night.dream != null) {
      queue.push({ seat: ctx.s.night.dream, cause: 'dream' });
    }
  }
  return [...out].map(([seat, cause]) => ({ seat, cause }));
}

function canShoot(ctx: Ctx, d: Death): boolean {
  const role = ctx.roleOf(d.seat);
  const shooter = typeof role.shooter === 'function' ? role.shooter(ctx, d.seat) : !!role.shooter;
  if (!shooter) return false;
  const r = ctx.rules;
  switch (d.cause) {
    case 'poison': return !!r.shootWhenPoisoned;
    case 'lover': return !!r.shootWhenLover;
    case 'charm': return false;
    case 'sameGuardSave': return !!r.shootWhenSameGuardSave;
    case 'taken': return !!r.shootWhenTaken;
    default: return true;
  }
}

function hasLastWords(ctx: Ctx, d: Death, phase: 'night' | 'day'): boolean {
  const r = ctx.rules;
  if (d.cause === 'explode' && !r.explodeLastWords) return false;
  if (d.cause === 'duel') return false;
  switch (r.lastWords) {
    case 'none': return false;
    case 'all': return true;
    case 'wolfCount':
      if (ctx.s.lastWordsLeft <= 0) return false;
      ctx.s.lastWordsLeft--;
      return true;
    default:
      return phase === 'day' || ctx.s.day === 1;
  }
}

/**
 * 让一批玩家出局，返回需要依次执行的后续步骤：发动技能、移交警徽、遗言。
 * 注意：返回的步骤由调用方插入议程，并在之后补一个 checkWin。
 */
export function killPlayers(ctx: Ctx, list: Death[], phase: 'night' | 'day'): Step[] {
  const all = expandChain(ctx, list, phase === 'night');
  for (const d of all) {
    const p = ctx.player(d.seat);
    p.alive = false;
    p.deathDay = ctx.s.day;
    p.deathCause = d.cause;
  }
  // 野孩子：榜样出局后变狼
  for (const p of ctx.s.players) {
    if (p.alive && p.role === 'wildChild' && !p.flags.convertedWolf && all.some((d) => d.seat === p.flags.model)) {
      p.flags.convertedWolf = true;
      ctx.tell(p.seat, '你的榜样已经出局，你变成了狼人，从下一晚起与狼队一起行动。');
    }
  }
  const steps: Step[] = [];
  const ordered = phase === 'night' ? [...all].sort((a, b) => a.seat - b.seat) : all;
  for (const d of ordered) {
    steps.push({ kind: 'deathSkill', seat: d.seat, can: canShoot(ctx, d) });
    if (ctx.s.sheriff === d.seat) steps.push({ kind: 'badge', seat: d.seat });
    if (hasLastWords(ctx, d, phase)) steps.push({ kind: 'speech', seat: d.seat, label: '发表遗言', group: `lw-${d.seat}-${ctx.s.seq}`, lastWords: true });
  }
  return steps;
}
