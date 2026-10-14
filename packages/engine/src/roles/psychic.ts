import { noteCheck, othersAlive, targetAction } from './helpers.ts';
import type { RoleDef } from './types.ts';

export const psychic: RoleDef = {
  id: 'psychic',
  name: '通灵师',
  faction: 'good',
  category: 'god',
  short: '每晚查验一名玩家的具体身份。',
  intro: {
    skill: '每晚可以查验一名玩家，法官会告诉你对方的具体身份（例如「女巫」「狼人」），信息量比预言家更大。又称「天眼」。',
    timing: '每晚，预言家的位置之后行动。',
    tips: [
      '通灵师通常要尽早起跳，报出验到的具体身份来取得信任。',
      '在机械狼板子里，报出队友的具体身份可能会让机械狼学到关键技能，要权衡。',
    ],
    interactions: [
      '查验未学习技能的机械狼显示为「狼人」；查验已学习的机械狼显示为它学到的身份。',
      '查验恶灵骑士会被反伤（可在恶灵骑士选项中关闭）。',
    ],
  },
  learnText: '每晚可查验一名玩家的具体身份',
  night: [
    targetAction({
      id: 'psychic', role: 'psychic', order: 112, name: '通灵师',
      title: '请选择今晚要查验的玩家',
      candidates: othersAlive,
      allowSkip: true,
      skipLabel: '不查验',
      record: (ctx, seat, target, picked) => {
        if (target == null) return '你今晚没有查验';
        if (ctx.cfg('evilKnight').reflectPsychic) noteCheck(ctx, seat, target);
        const text = `${picked}号的身份是：${ctx.roleName(ctx.exactSees(target))}`;
        ctx.tell(seat, `第${ctx.s.night.night}夜查验：${text}`);
        return text;
      },
    }),
  ],
};
