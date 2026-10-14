import { othersAlive, targetAction } from './helpers.ts';
import type { RoleDef } from './types.ts';

export const wildChild: RoleDef = {
  id: 'wildChild',
  name: '野孩子',
  faction: 'good',
  category: 'villager',
  short: '首夜选择一名榜样；榜样出局后野孩子变成狼人。',
  intro: {
    skill: '首夜选择一名其他玩家作为榜样。只要榜样存活，野孩子就是好人阵营的平民；一旦榜样出局，野孩子立即变成狼人，从下一晚起与狼队一起袭击。',
    timing: '仅首夜行动。',
    tips: ['选一个你觉得会活很久的人当榜样，或者选一个你认为是狼的人。'],
  },
  side: (ctx, seat) => (ctx.player(seat).flags.convertedWolf ? 'wolf' : 'good'),
  countsAs: (ctx, seat) => (ctx.player(seat).flags.convertedWolf ? 'wolf' : 'villager'),
  joinsWolfKill: (ctx, seat) => !!ctx.player(seat).flags.convertedWolf,
  canExplode: (ctx, seat) => !!ctx.player(seat).flags.convertedWolf,
  night: [
    targetAction({
      id: 'wildChild', role: 'wildChild', order: 40, name: '野孩子', firstNightOnly: true,
      title: '请选择你的榜样',
      candidates: othersAlive,
      allowSkip: false,
      record: (ctx, seat, _t, picked) => {
        ctx.player(seat).flags.model = picked;
        ctx.tell(seat, `你的榜样是${picked}号`);
        return `你的榜样是${picked}号`;
      },
      timeout: (ctx, seat) => {
        const m = ctx.pick(othersAlive(ctx, seat));
        ctx.player(seat).flags.model = m;
        ctx.tell(seat, `超时，系统为你随机选择了榜样：${m}号`);
      },
    }),
  ],
};
