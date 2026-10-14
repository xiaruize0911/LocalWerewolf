import { wakeOnly } from './helpers.ts';
import type { RoleDef } from './types.ts';

export const idiot: RoleDef = {
  id: 'idiot',
  name: '白痴',
  faction: 'good',
  category: 'god',
  short: '被放逐时可以翻牌免死，但之后失去投票权。',
  intro: {
    skill: '白天被投票放逐时，可以翻开身份牌，免于出局。翻牌后仍然可以发言，但不能再投票。夜里被杀则正常死亡。',
    timing: '只在首夜睁眼确认身份。',
    tips: [
      '白痴适合起跳挡刀或带节奏，因为被投出去也不会死。',
      '翻牌后的白痴第二次被放逐会真正出局。',
    ],
    variants: ['翻牌后是否失去投票权', '翻牌白痴是否计入存活神职'],
  },
  onExiled: (ctx, seat) => {
    const p = ctx.player(seat);
    if (p.flags.flipped) return false;
    p.flags.flipped = true;
    ctx.log(`${seat}号翻牌，身份是白痴，免于放逐${ctx.rules.idiotLoseVote ? '，之后失去投票权' : ''}`);
    ctx.pushFront(ctx.announce(`${seat}号是白痴，翻牌免于放逐`));
    return true;
  },
  canVote: (ctx, seat) => !(ctx.player(seat).flags.flipped && ctx.rules.idiotLoseVote),
  countsAs: (ctx, seat) => (ctx.player(seat).flags.flipped && !ctx.rules.idiotCountsAsGod ? null : 'god'),
  night: [wakeOnly({ id: 'idiot', role: 'idiot', order: 150, name: '白痴', firstNightOnly: true })],
};
