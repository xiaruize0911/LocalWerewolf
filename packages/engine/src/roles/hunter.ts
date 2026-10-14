import { aliveWith } from './helpers.ts';
import type { RoleDef } from './types.ts';

export const hunter: RoleDef = {
  id: 'hunter',
  name: '猎人',
  faction: 'good',
  category: 'god',
  shooter: true,
  short: '出局时可以开枪带走一名玩家。',
  intro: {
    skill: '被狼人杀害或被放逐出局时，可以开枪带走场上任意一名玩家。被女巫毒死时不能开枪。',
    timing: '每晚最后阶段睁眼，法官告知你当晚能否开枪。',
    tips: [
      '猎人是好人的「定时炸弹」，狼人往往不敢轻易刀你。',
      '开枪前想清楚，带走好人等于帮狼人。',
      '可以选择不开枪（压枪）。',
    ],
    interactions: ['被毒、殉情时默认不能开枪；同守同救死亡可以开枪。'],
    variants: ['被毒后能否开枪', '殉情后能否开枪', '同守同救死亡后能否开枪'],
  },
  learnText: '出局时可以开枪（学习当晚即生效）',
  night: [
    {
      id: 'hunter', roles: ['hunter'], order: 140, name: '猎人',
      actors: (ctx) => aliveWith(ctx, 'hunter'),
      spec: (ctx, seat) => {
        const poisoned = ctx.s.night.poison === seat || ctx.s.night.machinePoison === seat;
        const can = !poisoned || ctx.rules.shootWhenPoisoned;
        return { type: 'confirm', title: '你的开枪状态', desc: can ? '你今晚的开枪状态：可以开枪 👍' : '你今晚的开枪状态：不能开枪 👎', okLabel: '知道了' };
      },
      submit: () => {},
    },
  ],
};
