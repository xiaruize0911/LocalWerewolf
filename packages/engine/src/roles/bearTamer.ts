import type { Ctx } from '../ctx.ts';
import type { Seat } from '../types.ts';
import { wakeOnly } from './helpers.ts';
import type { RoleDef } from './types.ts';

/** 左右最近的存活玩家 */
export function aliveNeighbors(ctx: Ctx, seat: Seat): Seat[] {
  const seats = ctx.allSeats().sort((a, b) => a - b);
  const n = seats.length;
  const i = seats.indexOf(seat);
  const out: Seat[] = [];
  for (const dir of [-1, 1]) {
    for (let k = 1; k < n; k++) {
      const s = seats[(i + dir * k + n * k) % n];
      if (s !== seat && ctx.alive(s)) {
        if (!out.includes(s)) out.push(s);
        break;
      }
    }
  }
  return out;
}

export const bearTamer: RoleDef = {
  id: 'bearTamer',
  name: '驯熊师',
  faction: 'good',
  category: 'god',
  short: '每天天亮时，如果他左右相邻的存活玩家中有狼人，熊会咆哮。',
  intro: {
    skill: '驯熊师没有主动技能。每天天亮公布死讯后，如果驯熊师存活，且他左右两边最近的存活玩家中有狼人，法官会宣布「熊咆哮了」；否则宣布「熊没有咆哮」。',
    timing: '每晚睁眼示意身份；信息在天亮时公布。',
    tips: ['熊咆哮的信息对所有人公开，驯熊师要尽早跳身份帮助好人分析。'],
  },
  dayStart: (ctx) =>
    ctx.seatsOf('bearTamer', true).map((seat) => {
      const growl = aliveNeighbors(ctx, seat).some((s) => ctx.side(s) === 'wolf');
      const text = growl ? '熊咆哮了' : '熊没有咆哮';
      ctx.log(text);
      return ctx.announce(text);
    }),
  night: [wakeOnly({ id: 'bearTamer', role: 'bearTamer', order: 125, name: '驯熊师' })],
};
