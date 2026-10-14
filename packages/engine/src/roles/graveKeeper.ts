import { aliveWith, sideText } from './helpers.ts';
import type { RoleDef } from './types.ts';

export const graveKeeper: RoleDef = {
  id: 'graveKeeper',
  name: '守墓人',
  faction: 'good',
  category: 'god',
  short: '每晚得知前一天被放逐的玩家是好人还是狼人。',
  intro: {
    skill: '每晚睁眼时，法官会告诉你上一个白天被放逐的玩家是好人还是狼人。',
    timing: '每晚，预言家之后行动。',
    tips: [
      '守墓人的信息可以验证白天的投票是否正确，帮助好人校准判断。',
      '前一天没有人被放逐时，你不会得到信息。',
    ],
  },
  night: [
    {
      id: 'graveKeeper', roles: ['graveKeeper'], order: 115, name: '守墓人',
      actors: (ctx) => aliveWith(ctx, 'graveKeeper'),
      spec: (ctx) => {
        const le = ctx.s.lastExiled;
        const desc = le && le.day === ctx.s.night.night - 1
          ? `昨天被放逐的${le.seat}号是：${sideText(ctx.side(le.seat))}`
          : '昨天没有玩家被放逐。';
        return { type: 'confirm', title: '守墓人', desc, okLabel: '知道了' };
      },
      submit: (ctx, seat) => {
        const le = ctx.s.lastExiled;
        if (le && le.day === ctx.s.night.night - 1) {
          const t = `昨天被放逐的${le.seat}号是：${sideText(ctx.side(le.seat))}`;
          ctx.tell(seat, `第${ctx.s.night.night}夜：${t}`);
          return t;
        }
      },
    },
  ],
};
