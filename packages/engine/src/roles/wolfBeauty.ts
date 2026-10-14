import { othersAlive, targetAction } from './helpers.ts';
import type { RoleDef } from './types.ts';

export const wolfBeauty: RoleDef = {
  id: 'wolfBeauty',
  name: '狼美人',
  faction: 'wolf',
  category: 'wolf',
  wolfTeam: true,
  canExplode: (ctx) => !!ctx.cfg('wolfBeauty').canExplode,
  short: '狼人阵营，每晚魅惑一名玩家，狼美人出局时被魅惑者随之殉情。',
  intro: {
    skill: '夜里和狼人一起袭击，之后单独睁眼魅惑一名玩家。狼美人出局时，当前被魅惑的玩家会随之殉情出局，且无法发动技能。默认不能自爆。',
    timing: '每晚，狼人之后行动。',
    tips: ['魅惑猎人等有出局技能的神职，可以让他们殉情时无法发动技能。'],
  },
  config: [
    { key: 'canExplode', group: '狼美人', label: '狼美人能否自爆', desc: '', type: 'select', default: false, options: [{ value: false, label: '不能' }, { value: true, label: '可以' }] },
  ],
  night: [
    targetAction({
      id: 'wolfBeauty', role: 'wolfBeauty', order: 80, name: '狼美人',
      title: '请选择今晚要魅惑的玩家',
      candidates: othersAlive,
      allowSkip: true,
      skipLabel: '不魅惑',
      record: (ctx, seat, target, picked) => {
        ctx.s.night.charm = target;
        ctx.rs('wolfBeauty')[seat] = target;
        return picked == null ? '你今晚没有魅惑' : `你魅惑了${picked}号`;
      },
    }),
  ],
};
