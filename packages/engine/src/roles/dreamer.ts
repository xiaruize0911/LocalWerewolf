import { othersAlive, targetAction } from './helpers.ts';
import type { RoleDef } from './types.ts';

export const dreamer: RoleDef = {
  id: 'dreamer',
  name: '摄梦人',
  faction: 'good',
  category: 'god',
  short: '每晚让一名玩家梦游，梦游者当晚免疫夜间伤害。',
  intro: {
    skill: '每晚必须选择一名其他玩家成为「梦游者」，梦游者当晚免疫一切夜间伤害（狼刀、毒药）。如果摄梦人在夜间死亡，梦游者会一并出局；同一名玩家连续两晚成为梦游者也会出局。',
    timing: '每晚，在守卫之前行动。',
    tips: [
      '摄梦人相当于一个更强但有风险的守卫。',
      '不要连续两晚摄同一个人，否则会把他「梦死」。',
    ],
    interactions: ['梦游者免疫女巫的毒药，也免疫狼刀。'],
  },
  config: [
    { key: 'twoNightsDies', group: '摄梦人', label: '连续两晚梦游会死亡', desc: '', type: 'select', default: true, options: [{ value: true, label: '是' }, { value: false, label: '否' }] },
  ],
  night: [
    targetAction({
      id: 'dreamer', role: 'dreamer', order: 58, name: '摄梦人',
      title: '请选择今晚的梦游者',
      desc: (ctx, seat) => {
        const last = ctx.rs('dreamer')[seat];
        return last && last.night === ctx.s.night.night - 1 ? `昨晚的梦游者是${last.target}号，连续两晚梦游会出局。` : '必须选择一名玩家。';
      },
      candidates: othersAlive,
      allowSkip: false,
      record: (ctx, seat, target, picked) => {
        const last = ctx.rs('dreamer')[seat];
        ctx.s.night.dream = target;
        ctx.rs('dreamer')[seat] = { night: ctx.s.night.night, target: picked, repeat: !!(last && last.night === ctx.s.night.night - 1 && last.target === picked) };
        return `今晚的梦游者是${picked}号`;
      },
    }),
  ],
};
