import { wakeOnly } from './helpers.ts';
import type { RoleDef } from './types.ts';

export const knight: RoleDef = {
  id: 'knight',
  name: '骑士',
  faction: 'good',
  category: 'god',
  dayActions: ['duel'],
  short: '白天可以和一名玩家决斗：对方是狼则狼死，否则骑士死。',
  intro: {
    skill: '白天发言阶段（警长竞选除外），可以翻牌与任意一名玩家决斗。若对方是狼人，狼人立即出局并直接进入黑夜；若对方是好人，骑士以死谢罪。整局只能决斗一次。',
    timing: '只在首夜睁眼确认身份，技能在白天发动。',
    tips: [
      '决斗前尽量收集信息，决斗失败会损失一名神职。',
      '决斗成功会立即入夜，当天不再投票。',
    ],
  },
  night: [wakeOnly({ id: 'knight', role: 'knight', order: 160, name: '骑士', firstNightOnly: true })],
};
