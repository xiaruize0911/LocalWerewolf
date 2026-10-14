import { targetAction } from './helpers.ts';
import type { RoleDef } from './types.ts';

export const voteBanner: RoleDef = {
  id: 'voteBanner',
  name: '禁票长老',
  faction: 'good',
  category: 'god',
  short: '每晚指定一名玩家，他第二天不能投票。',
  intro: {
    skill: '每晚可以指定一名玩家，该玩家在第二天白天的投票中没有投票权（法官天亮时公布）。',
    timing: '每晚，在禁言长老之后行动。',
    tips: ['用来压制可能冲票的狼人。'],
  },
  night: [
    targetAction({
      id: 'voteBanner', role: 'voteBanner', order: 132, name: '禁票长老',
      title: '请选择今晚要禁票的玩家',
      candidates: (ctx) => ctx.aliveSeats(),
      allowSkip: true,
      skipLabel: '不禁票',
      record: (ctx, _seat, target, picked) => {
        ctx.s.night.voteBan = target;
        return picked == null ? '你今晚没有禁票' : `你禁止了${picked}号投票`;
      },
    }),
  ],
};
