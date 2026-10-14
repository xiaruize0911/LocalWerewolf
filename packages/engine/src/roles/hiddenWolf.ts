import { seatList } from '../ctx.ts';
import { aliveWith } from './helpers.ts';
import type { RoleDef } from './types.ts';

export const hiddenWolf: RoleDef = {
  id: 'hiddenWolf',
  name: '隐狼',
  faction: 'wolf',
  category: 'wolf',
  seesWolfTeam: true,
  canExplode: false,
  short: '狼人阵营，被预言家查验为好人；其他狼死光后才能刀人。',
  intro: {
    skill: '隐狼知道狼队友是谁，但狼队友不知道他。被预言家查验时显示为好人。不能自爆，也不参与袭击，直到其他狼人全部出局后才获得狼刀。',
    timing: '首夜单独睁眼认识狼队友；获得狼刀后在「狼人」环节睁眼。',
    tips: ['你是天然的「金水」狼，可以大胆站边带节奏。'],
  },
  seerSees: () => 'good',
  joinsWolfKill: (ctx, seat) => !ctx.wolfTeamSeats().some((s) => s !== seat && ctx.alive(s)),
  night: [
    {
      id: 'hiddenWolf', roles: ['hiddenWolf'], order: 90, name: '隐狼', firstNightOnly: true,
      actors: (ctx) => aliveWith(ctx, 'hiddenWolf'),
      spec: (ctx) => ({ type: 'confirm', title: '隐狼', desc: `你的狼队友是：${seatList(ctx.wolfTeamSeats()) || '无'}。他们不知道你的身份。`, okLabel: '知道了' }),
      submit: () => {},
    },
  ],
};
