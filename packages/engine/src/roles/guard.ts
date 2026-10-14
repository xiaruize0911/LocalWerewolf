import type { Ctx } from '../ctx.ts';
import type { Seat } from '../types.ts';
import { targetAction } from './helpers.ts';
import type { RoleDef } from './types.ts';

function candidates(ctx: Ctx, seat: Seat): Seat[] {
  const last = ctx.rs('guard')[seat] as { night: number; target: Seat } | undefined;
  return ctx.aliveSeats().filter((s) => {
    if (s === seat && !ctx.rules.guardSelf) return false;
    if (!ctx.rules.guardRepeat && last && last.night === ctx.s.night.night - 1 && last.target === s) return false;
    return true;
  });
}

export const guard: RoleDef = {
  id: 'guard',
  name: '守卫',
  faction: 'good',
  category: 'god',
  short: '每晚守护一名玩家，使其免受狼人袭击。',
  intro: {
    skill: '每晚可以守护一名玩家（可以守自己），被守护的玩家当晚不会被狼人杀死。不能连续两晚守护同一人。',
    timing: '每晚，在狼人之前行动。',
    tips: [
      '首夜常见策略是空守，避免和女巫解药撞车（同守同救）。',
      '守护跳出来的预言家通常收益很高。',
    ],
    interactions: [
      '守护和解药落在同一人身上（同守同救）时，该玩家仍然死亡。',
      '守卫挡不住女巫的毒药。',
    ],
    variants: ['同守同救是否死亡', '能否连续守同一人', '能否自守、空守'],
  },
  learnText: '获得一次守护（可挡狼刀和毒药），下一晚起可用',
  night: [
    targetAction({
      id: 'guard', role: 'guard', order: 60, name: '守卫',
      title: '请选择今晚要守护的玩家',
      desc: (ctx, seat) => {
        const last = ctx.rs('guard')[seat];
        return last && last.night === ctx.s.night.night - 1 && !ctx.rules.guardRepeat ? `昨晚你守护了${last.target}号，今晚不能再守他。` : undefined;
      },
      candidates,
      allowSkip: (ctx) => !!ctx.rules.guardEmpty,
      skipLabel: '空守',
      record: (ctx, seat, target, picked) => {
        if (picked != null) ctx.rs('guard')[seat] = { night: ctx.s.night.night, target: picked };
        else delete ctx.rs('guard')[seat];
        ctx.s.night.guard = target;
        const text = picked == null ? '你今晚空守' : `你守护了${picked}号`;
        ctx.tell(seat, `第${ctx.s.night.night}夜：${text}`);
        return text;
      },
    }),
  ],
};
