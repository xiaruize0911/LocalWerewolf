import type { Ctx } from '../ctx.ts';
import { expandChain, type Death } from '../deaths.ts';
import type { DeathCause, Seat } from '../types.ts';

/**
 * 天亮时结算夜晚。按固定阶段执行：
 *   狼刀（守护/解药/同守同救/双刀/梦游/机械狼守护）→ 毒药 → 猎魔人狩猎 → 恶灵骑士反伤
 *   → 摄梦人连续梦游 → 连锁（殉情、狼美人、摄梦人）
 * 返回待公布的死亡列表（玩家此时仍标记为存活，公布死讯时才真正出局）。
 */
export function resolveNight(ctx: Ctx): Death[] {
  const n = ctx.s.night;
  const deaths = new Map<Seat, DeathCause>();
  const add = (seat: Seat | null | undefined, cause: DeathCause) => {
    if (seat == null || !ctx.alive(seat) || deaths.has(seat)) return;
    deaths.set(seat, cause);
  };
  const isEvilKnight = (seat: Seat) => ctx.player(seat).role === 'evilKnight';
  const ek = ctx.rs('evilKnight');

  // ---- 狼刀 ----
  const pierce = n.wolfKill != null && n.wolfKill2 === n.wolfKill;
  const kills = [...new Set([n.wolfKill, pierce ? null : n.wolfKill2].filter((x): x is Seat => x != null))];
  for (const t of kills) {
    if (!ctx.alive(t) || isEvilKnight(t) || n.dream === t) continue;
    if (pierce) {
      add(t, 'wolf');
      continue;
    }
    if (n.machineGuard === t) continue;
    const guarded = n.guard === t;
    const saved = n.save && t === n.wolfKill;
    if (guarded && saved) {
      if (ctx.rules.sameGuardSave === 'dies') add(t, 'sameGuardSave');
      continue;
    }
    if (guarded || saved) continue;
    add(t, 'wolf');
  }

  // ---- 毒药 ----
  const machine = ctx.s.players.find((p) => p.role === 'machineWolf')?.seat ?? null;
  for (const [p, by] of [[n.poison, n.poisonBy], [n.machinePoison, machine]] as const) {
    if (p == null) continue;
    if (isEvilKnight(p)) {
      if (!ek.reflected && by != null && ctx.player(by).role === 'witch') {
        ek.reflected = true;
        add(by, 'reflect');
      }
      continue;
    }
    if (ctx.player(p).role === 'demonHunter' || n.dream === p || n.machineGuard === p) continue;
    add(p, 'poison');
  }

  // ---- 猎魔人 ----
  if (n.hunt != null && n.hunter != null && ctx.alive(n.hunter)) {
    const t = n.hunt;
    if (!isEvilKnight(t)) {
      if (ctx.side(t) === 'wolf') {
        if (n.dream !== t) add(t, 'hunt');
      } else add(n.hunter, 'huntFail');
    }
  }

  // ---- 恶灵骑士反伤（查验） ----
  for (const c of n.checks) {
    if (!ek.reflected && isEvilKnight(c.target) && ctx.player(c.by).role !== 'machineWolf') {
      ek.reflected = true;
      add(c.by, 'reflect');
    }
  }

  // ---- 摄梦人：连续两晚梦游 ----
  if (ctx.cfg('dreamer').twoNightsDies) {
    for (const seat of ctx.seatsOf('dreamer', true)) {
      const st = ctx.rs('dreamer')[seat];
      if (st && st.night === n.night && st.repeat) add(n.dream, 'dream');
    }
  }

  const list = [...deaths].map(([seat, cause]) => ({ seat, cause }));
  return expandChain(ctx, list, true);
}
