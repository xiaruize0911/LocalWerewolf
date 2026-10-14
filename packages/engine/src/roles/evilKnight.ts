import type { RoleDef } from './types.ts';

export const evilKnight: RoleDef = {
  id: 'evilKnight',
  name: '恶灵骑士',
  faction: 'wolf',
  category: 'wolf',
  wolfTeam: true,
  canExplode: false,
  short: '狼人阵营，夜间不会死亡，查验或毒他的神职会被反伤。',
  intro: {
    skill: '夜里和狼人一起袭击，不能自爆，也不会在夜间死亡（免疫狼刀和毒药）。拥有一次反伤：被预言家查验时，预言家在当晚死亡；被女巫毒时，女巫在当晚死亡。',
    timing: '每晚随狼队一起睁眼。',
    tips: [
      '恶灵骑士只能在白天被投票放逐出局。',
      '预言家验到你会被反伤，所以你可以大胆地与预言家对跳。',
    ],
    interactions: ['反伤只生效一次；守卫无法挡住反伤。'],
  },
  config: [
    { key: 'reflectPsychic', group: '恶灵骑士', label: '通灵师查验也会被反伤', desc: '', type: 'select', default: true, options: [{ value: true, label: '是' }, { value: false, label: '否' }] },
  ],
};
