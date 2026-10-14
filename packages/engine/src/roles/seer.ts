import { noteCheck, othersAlive, sideText, targetAction } from './helpers.ts';
import type { RoleDef } from './types.ts';

export const seer: RoleDef = {
  id: 'seer',
  name: '预言家',
  faction: 'good',
  category: 'god',
  short: '每晚查验一名玩家是好人还是狼人。',
  intro: {
    skill: '每晚可以查验一名玩家的阵营，法官会告诉你对方是「好人」还是「狼人」。',
    timing: '每晚，女巫之后行动。',
    tips: [
      '被查验为好人的玩家叫「金水」，被查验为狼人的叫「查杀」。',
      '预言家通常要尽早跳出来报验人信息，并留好「警徽流」（死后警徽交给谁、接下来验谁）。',
      '小心狼人悍跳预言家和你对跳。',
    ],
    interactions: [
      '隐狼被查验时显示为好人。',
      '查验恶灵骑士会被反伤，第二天预言家出局。',
      '魔术师交换号码后，查验结果是交换后那位玩家的身份。',
    ],
  },
  learnText: '每晚可查验一名玩家是好人还是狼人',
  night: [
    targetAction({
      id: 'seer', role: 'seer', order: 110, name: '预言家',
      title: '请选择今晚要查验的玩家',
      candidates: othersAlive,
      allowSkip: true,
      skipLabel: '不查验',
      record: (ctx, seat, target, picked) => {
        if (target == null) return '你今晚没有查验';
        noteCheck(ctx, seat, target);
        const text = `${picked}号的身份是：${sideText(ctx.seerSees(target))}`;
        ctx.tell(seat, `第${ctx.s.night.night}夜查验：${text}`);
        return text;
      },
    }),
  ],
};
