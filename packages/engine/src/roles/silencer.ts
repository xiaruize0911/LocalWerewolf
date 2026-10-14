import { targetAction } from './helpers.ts';
import type { RoleDef } from './types.ts';

export const silencer: RoleDef = {
  id: 'silencer',
  name: '禁言长老',
  faction: 'good',
  category: 'god',
  short: '每晚禁言一名玩家，他第二天不能发言。',
  intro: {
    skill: '每晚可以禁言一名玩家，该玩家在第二天白天不能发言（法官天亮时公布被禁言者）。可以选择不禁言。',
    timing: '每晚，在预言家之后行动。',
    tips: ['禁言疑似悍跳的狼人，可以打乱狼队的节奏。'],
  },
  night: [
    targetAction({
      id: 'silencer', role: 'silencer', order: 130, name: '禁言长老',
      title: '请选择今晚要禁言的玩家',
      candidates: (ctx) => ctx.aliveSeats(),
      allowSkip: true,
      skipLabel: '不禁言',
      record: (ctx, _seat, target, picked) => {
        ctx.s.night.silence = target;
        return picked == null ? '你今晚没有禁言' : `你禁言了${picked}号`;
      },
    }),
  ],
};
