import type { RoleDef } from './types.ts';

export const whiteWolfKing: RoleDef = {
  id: 'whiteWolfKing',
  name: '白狼王',
  faction: 'wolf',
  category: 'wolf',
  wolfTeam: true,
  canExplode: true,
  short: '狼人阵营，白天自爆时可以带走一名玩家。',
  intro: {
    skill: '夜里和狼人一起袭击。白天可以选择自爆，并同时带走场上任意一名玩家。非自爆的方式出局时没有技能。',
    timing: '每晚随狼队一起睁眼；技能在白天发动。',
    tips: [
      '白狼王自爆带人可以精准击杀已跳身份的预言家或女巫。',
      '自爆后直接进入黑夜，可以打断好人的节奏。',
    ],
    variants: ['被白狼王带走的猎人能否开枪'],
  },
  onExplode: (_ctx, seat) => [{ kind: 'whiteWolfTake', seat }],
};
