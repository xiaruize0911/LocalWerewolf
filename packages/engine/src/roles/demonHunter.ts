import { othersAlive, targetAction } from './helpers.ts';
import type { RoleDef } from './types.ts';

export const demonHunter: RoleDef = {
  id: 'demonHunter',
  name: '猎魔人',
  faction: 'good',
  category: 'god',
  short: '从第二晚起可以狩猎一名玩家：是狼则狼死，否则自己死。',
  intro: {
    skill: '从第二晚开始，每晚可以选择狩猎一名玩家。若对方是狼人，对方当晚出局；若对方是好人，猎魔人自己出局。女巫的毒药对猎魔人无效。',
    timing: '第二晚起每晚行动，在预言家之后。',
    tips: ['没有把握时可以不狩猎。', '猎魔人免疫毒药，女巫毒你是没用的。'],
    interactions: ['恶灵骑士不会在夜间死亡，狩猎他不会成功也不会失败。'],
  },
  night: [
    targetAction({
      id: 'demonHunter', role: 'demonHunter', order: 118, name: '猎魔人', fromNight: 2,
      title: '请选择今晚要狩猎的玩家',
      candidates: othersAlive,
      allowSkip: true,
      skipLabel: '不狩猎',
      record: (ctx, seat, target, picked) => {
        ctx.s.night.hunt = target;
        ctx.s.night.hunter = target == null ? null : seat;
        return picked == null ? '你今晚没有狩猎' : `你狩猎了${picked}号`;
      },
    }),
  ],
};
