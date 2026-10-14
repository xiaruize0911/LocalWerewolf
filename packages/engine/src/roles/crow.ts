import type { Ctx } from '../ctx.ts';
import type { Seat } from '../types.ts';
import { targetAction } from './helpers.ts';
import type { RoleDef } from './types.ts';

function candidates(ctx: Ctx, seat: Seat): Seat[] {
  const last = ctx.rs('crow')[seat] as { night: number; target: Seat } | undefined;
  return ctx.aliveSeats().filter((s) => !(last && last.night === ctx.s.night.night - 1 && last.target === s));
}

export const crow: RoleDef = {
  id: 'crow',
  name: '乌鸦',
  faction: 'good',
  category: 'god',
  short: '每晚诅咒一名玩家，他在第二天的放逐投票中额外多一票。',
  intro: {
    skill: '每晚可以诅咒一名玩家，该玩家在第二天的放逐投票中会被额外计入一票。不能连续两晚诅咒同一人。',
    timing: '每晚，在预言家之后行动。',
    tips: ['诅咒你怀疑的玩家，帮助好人把他投出去。', '投票结果中会显示乌鸦的额外一票。'],
  },
  night: [
    targetAction({
      id: 'crow', role: 'crow', order: 120, name: '乌鸦',
      title: '请选择今晚要诅咒的玩家',
      candidates,
      allowSkip: true,
      skipLabel: '不诅咒',
      record: (ctx, seat, target, picked) => {
        ctx.s.night.curse = target;
        if (picked != null) ctx.rs('crow')[seat] = { night: ctx.s.night.night, target: picked };
        else delete ctx.rs('crow')[seat];
        return picked == null ? '你今晚没有诅咒' : `你诅咒了${picked}号`;
      },
    }),
  ],
};
