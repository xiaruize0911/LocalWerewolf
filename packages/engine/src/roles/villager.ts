import type { RoleDef } from './types.ts';

export const villager: RoleDef = {
  id: 'villager',
  name: '平民',
  faction: 'good',
  category: 'villager',
  short: '没有特殊技能，依靠推理和投票找出狼人。',
  intro: {
    skill: '没有任何夜间技能，晚上全程闭眼。白天通过发言和投票帮助好人找出狼人。',
    timing: '不需要夜间行动。',
    tips: [
      '多听发言，留意谁的逻辑前后矛盾。',
      '屠边规则下平民也是狼人的目标，平民全部出局时狼人获胜。',
      '不要轻易假跳神职，以免干扰好人判断。',
    ],
  },
};
