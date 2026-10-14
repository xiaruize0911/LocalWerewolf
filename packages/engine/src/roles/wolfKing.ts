import type { RoleDef } from './types.ts';

export const wolfKing: RoleDef = {
  id: 'wolfKing',
  name: '狼王',
  faction: 'wolf',
  category: 'wolf',
  wolfTeam: true,
  canExplode: true,
  shooter: true,
  short: '狼人阵营，出局时可以开枪带走一名玩家。',
  intro: {
    skill: '夜里和狼人一起袭击。被放逐、被狼刀或自爆出局时，可以开枪带走一名玩家；被女巫毒死时不能开枪。又称「黑狼王」。',
    timing: '每晚随狼队一起睁眼。',
    tips: [
      '狼王可以自爆后开枪，带走对狼队威胁最大的神职。',
      '开枪会暴露你的狼人身份，时机要选好。',
    ],
    variants: ['被毒后能否开枪'],
  },
};
