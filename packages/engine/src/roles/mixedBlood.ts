import { othersAlive, targetAction } from './helpers.ts';
import type { RoleDef } from './types.ts';

export const mixedBlood: RoleDef = {
  id: 'mixedBlood',
  name: '混血儿',
  faction: 'good',
  category: 'villager',
  short: '首夜选择一名榜样，与榜样属于同一阵营。',
  intro: {
    skill: '首夜选择一名其他玩家作为榜样，混血儿与榜样同阵营获胜（榜样是狼人则跟随狼人）。混血儿没有技能，被预言家查验始终显示为好人。榜样为狼人时，混血儿不计入屠边的平民数，也不需要被放逐好人才能获胜。',
    timing: '仅首夜行动。',
    tips: ['你不知道榜样的身份，需要通过白天发言判断自己属于哪边。'],
  },
  side: (ctx, seat) => {
    const m = ctx.player(seat).flags.model;
    return m != null && ctx.side(m) === 'wolf' ? 'wolf' : 'good';
  },
  seerSees: () => 'good',
  countsAs: (ctx, seat) => (ctx.side(seat) === 'wolf' ? null : 'villager'),
  night: [
    targetAction({
      id: 'mixedBlood', role: 'mixedBlood', order: 45, name: '混血儿', firstNightOnly: true,
      title: '请选择你的榜样',
      candidates: othersAlive,
      allowSkip: false,
      record: (ctx, seat, _t, picked) => {
        ctx.player(seat).flags.model = picked;
        ctx.tell(seat, `你的榜样是${picked}号，你与他同阵营`);
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
