import type { RoleDef } from './types.ts';

export const bloodMoon: RoleDef = {
  id: 'bloodMoon',
  name: '血月使徒',
  faction: 'wolf',
  category: 'wolf',
  wolfTeam: true,
  canExplode: true,
  short: '狼人阵营，自爆后当晚所有好人的技能都被封印。',
  intro: {
    skill: '夜里和狼人一起袭击。白天自爆后直接进入黑夜，当晚所有好人阵营的技能都会被封印（无法使用）。',
    timing: '每晚随狼队一起睁眼；技能在白天自爆时发动。',
    tips: ['在关键轮次自爆，可以让狼人当晚的刀必定成功（守卫、女巫都被封印）。'],
    variants: ['「最后一狼被放逐后延迟到天亮出局」的变体本应用暂不支持。'],
  },
  onExplode: (ctx) => {
    ctx.rs('bloodMoon').sealNight = ctx.s.day + 1;
    return [];
  },
};
