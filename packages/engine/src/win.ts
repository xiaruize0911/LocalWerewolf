import type { Ctx } from './ctx.ts';
import type { Faction } from './types.ts';

export interface WinResult {
  faction: Faction;
  text: string;
}

/**
 * 胜负判定：
 *  - 第三方（人狼恋情侣 + 丘比特）：存活者全部是第三方。
 *  - 好人：存活者中没有狼，且情侣第三方已出局。
 *  - 狼人：屠边 = 所有神或所有民出局；屠城 = 所有神民出局；同时情侣第三方已出局。
 *  好人和狼人条件同时满足时判狼人获胜。
 */
export function evaluateWin(ctx: Ctx): WinResult | null {
  const alive = ctx.aliveSeats();
  const cupid = ctx.s.roleState.cupid;
  const thirdActive = !!cupid?.third;
  const thirdAlive = thirdActive && alive.some((s) => cupid.lovers.includes(s));

  if (thirdActive && thirdAlive && alive.every((s) => ctx.team(s) === 'third')) {
    return { faction: 'third', text: '情侣阵营获胜' };
  }

  const count = (seats: number[], kind: 'wolf' | 'god' | 'villager') => seats.filter((s) => ctx.countsAs(s) === kind).length;
  const everyone = ctx.allSeats();
  const wolves = count(alive, 'wolf');
  const gods = count(alive, 'god');
  const villagers = count(alive, 'villager');
  const totalGods = count(everyone, 'god');
  const totalVillagers = count(everyone, 'villager');

  let wolfWin: boolean;
  let how: string;
  if (ctx.rules.winMode === 'city') {
    wolfWin = gods + villagers === 0;
    how = '屠城';
  } else {
    const godsOut = totalGods > 0 && gods === 0;
    const villagersOut = totalVillagers > 0 && villagers === 0;
    wolfWin = godsOut || villagersOut || gods + villagers === 0;
    how = godsOut ? '屠神' : '屠民';
  }
  wolfWin = wolfWin && !thirdAlive;
  if (wolfWin) return { faction: 'wolf', text: `狼人阵营获胜（${how}）` };
  if (wolves === 0 && !thirdAlive) return { faction: 'good', text: '好人阵营获胜' };
  return null;
}
