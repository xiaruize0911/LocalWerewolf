import type { Ctx } from '../ctx.ts';
import type { Seat } from '../types.ts';
import { targetAction } from './helpers.ts';
import type { RoleDef } from './types.ts';

function candidates(ctx: Ctx, seat: Seat): Seat[] {
  const last = ctx.rs('nightmare')[seat] as { night: number; target: Seat } | undefined;
  return ctx.aliveSeats().filter((s) => s !== seat && !(last && last.night === ctx.s.night.night - 1 && last.target === s));
}

export const nightmare: RoleDef = {
  id: 'nightmare',
  name: '噩梦之影',
  faction: 'wolf',
  category: 'wolf',
  wolfTeam: true,
  canExplode: true,
  short: '狼人阵营，每晚最先行动，恐惧一名玩家使其当晚无法使用技能。',
  intro: {
    skill: '每晚第一个睁眼，选择恐惧一名玩家，被恐惧的玩家当晚无法发动技能。不能恐惧自己，也不能连续两晚恐惧同一人。之后和狼人一起睁眼袭击。',
    timing: '每晚第一个行动。',
    tips: [
      '恐惧疑似女巫或守卫的玩家，可以让当晚的袭击更容易成功。',
      '被恐惧的玩家会在手机上看到「今晚无法行动」。',
    ],
  },
  night: [
    targetAction({
      id: 'nightmare', role: 'nightmare', order: 50, name: '噩梦之影',
      title: '请选择今晚要恐惧的玩家',
      desc: () => '被恐惧的玩家今晚无法使用技能。',
      candidates,
      allowSkip: true,
      skipLabel: '不恐惧',
      record: (ctx, seat, _t, picked) => {
        ctx.s.night.fear = picked;
        if (picked != null) ctx.rs('nightmare')[seat] = { night: ctx.s.night.night, target: picked };
        else delete ctx.rs('nightmare')[seat];
        return picked == null ? '你今晚没有恐惧任何人' : `你恐惧了${picked}号`;
      },
    }),
  ],
};
