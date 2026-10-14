import { otherWolvesAlive, othersAlive, targetAction } from './helpers.ts';
import type { RoleDef } from './types.ts';

export const gargoyle: RoleDef = {
  id: 'gargoyle',
  name: '石像鬼',
  faction: 'wolf',
  category: 'wolf',
  loneWolf: true,
  canExplode: false,
  short: '独自行动的狼，每晚查验一名玩家的具体身份。',
  intro: {
    skill: '石像鬼不与狼队见面，不参与袭击，也不能自爆。每晚可以查验一名玩家的具体身份。其他狼人全部出局后，石像鬼获得狼刀，可以在夜间袭击。',
    timing: '每晚在狼人之后单独睁眼；获得狼刀后也会在「狼人」环节睁眼。',
    tips: [
      '你掌握大量信息，但狼队友不知道你是谁，需要在白天通过发言暗中配合。',
      '常与「守墓人」搭配出现在「石像鬼守墓人」板子中。',
    ],
  },
  joinsWolfKill: (ctx, seat) => !otherWolvesAlive(ctx, seat),
  night: [
    targetAction({
      id: 'gargoyle', role: 'gargoyle', order: 96, name: '石像鬼',
      title: '请选择今晚要查验具体身份的玩家',
      desc: (ctx, seat) => (ctx.joinsWolfKill(seat) ? '其他狼人已全部出局，你已获得狼刀。' : undefined),
      candidates: othersAlive,
      allowSkip: true,
      skipLabel: '不查验',
      record: (ctx, seat, target, picked) => {
        if (target == null) return '你今晚没有查验';
        const text = `${picked}号的身份是：${ctx.roleName(ctx.exactSees(target))}`;
        ctx.tell(seat, `第${ctx.s.night.night}夜查验：${text}`);
        return text;
      },
    }),
  ],
};
