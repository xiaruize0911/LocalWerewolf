import type { Board, Rules } from './types.ts';

export interface Preset {
  id: string;
  name: string;
  players: number;
  board: Board;
  rules?: Partial<Rules>;
  difficulty: '入门' | '标准' | '进阶';
  desc: string;
  tips: string[];
}

/** 内置板子，按常见程度排序 */
export const PRESETS: Preset[] = [
  {
    id: 'std12', name: '预女猎白 12人', players: 12, difficulty: '入门',
    board: { werewolf: 4, villager: 4, seer: 1, witch: 1, hunter: 1, idiot: 1 },
    desc: '最经典的标准局：4 狼 4 民，神职为预言家、女巫、猎人、白痴。',
    tips: ['新手首选，规则最常见。', '好人靠预言家报验人、女巫用药建立信息，狼人常常悍跳预言家。'],
  },
  {
    id: 'wolfKingGuard12', name: '狼王守卫 12人', players: 12, difficulty: '标准',
    board: { werewolf: 3, wolfKing: 1, villager: 4, seer: 1, witch: 1, hunter: 1, guard: 1 },
    desc: '3 狼 + 狼王，神职为预言家、女巫、猎人、守卫。',
    tips: ['守卫和女巫要注意避免同守同救。', '狼王出局可以开枪，狼队容错更高。'],
  },
  {
    id: 'whiteWolfGuard12', name: '白狼王守卫 12人', players: 12, difficulty: '标准',
    board: { werewolf: 3, whiteWolfKing: 1, villager: 4, seer: 1, witch: 1, hunter: 1, guard: 1 },
    desc: '3 狼 + 白狼王，神职为预言家、女巫、猎人、守卫。',
    tips: ['白狼王可以在白天自爆带走一名玩家，常用来击杀预言家。'],
  },
  {
    id: 'whiteWolfKnight12', name: '白狼王骑士 12人', players: 12, difficulty: '标准',
    board: { werewolf: 3, whiteWolfKing: 1, villager: 4, seer: 1, witch: 1, hunter: 1, knight: 1 },
    desc: '3 狼 + 白狼王，神职为预言家、女巫、猎人、骑士。',
    tips: ['骑士白天可以决斗，决斗出狼人立即入夜。'],
  },
  {
    id: 'machinePsychic12', name: '机械狼通灵师 12人', players: 12, difficulty: '进阶',
    board: { werewolf: 3, machineWolf: 1, villager: 4, psychic: 1, witch: 1, hunter: 1, guard: 1 },
    desc: '3 狼 + 机械狼，神职为通灵师、女巫、猎人、守卫。通灵师能验出具体身份，机械狼可以学习他人技能。',
    tips: ['机械狼与狼队互不见面，其他狼全部出局后才获得狼刀。', '通灵师查验未学习的机械狼显示为「狼人」。'],
  },
  {
    id: 'gargoyleGrave12', name: '石像鬼守墓人 12人', players: 12, difficulty: '进阶',
    board: { werewolf: 3, gargoyle: 1, villager: 4, seer: 1, witch: 1, hunter: 1, graveKeeper: 1 },
    desc: '3 狼 + 石像鬼，神职为预言家、女巫、猎人、守墓人。',
    tips: ['石像鬼每晚验具体身份但不能刀人，直到其他狼全部出局。', '守墓人每晚得知前一天放逐的人是好是狼。'],
  },
  {
    id: 'evilKnight12', name: '恶灵骑士 12人', players: 12, difficulty: '进阶',
    board: { werewolf: 3, evilKnight: 1, villager: 4, seer: 1, witch: 1, hunter: 1, guard: 1 },
    desc: '3 狼 + 恶灵骑士，神职为预言家、女巫、猎人、守卫。',
    tips: ['恶灵骑士夜间不会死，查验或毒他会被反伤。'],
  },
  {
    id: 'std10', name: '预女猎 10人', players: 10, difficulty: '入门',
    board: { werewolf: 3, villager: 4, seer: 1, witch: 1, hunter: 1 },
    desc: '10 人局：3 狼 4 民，神职为预言家、女巫、猎人。',
    tips: ['人数较少时节奏更快，适合熟悉流程。'],
  },
  {
    id: 'std9city', name: '9人屠城局', players: 9, difficulty: '入门',
    board: { werewolf: 3, villager: 3, seer: 1, witch: 1, hunter: 1 },
    rules: { winMode: 'city', sheriff: false },
    desc: '9 人局：3 狼 3 民，神职为预言家、女巫、猎人，屠城规则、无警长。',
    tips: ['屠城规则下狼人需要杀光所有好人才能获胜。'],
  },
  {
    id: 'mini6', name: '6人体验局', players: 6, difficulty: '入门',
    board: { werewolf: 2, villager: 2, seer: 1, witch: 1 },
    rules: { winMode: 'city', sheriff: false },
    desc: '6 人小局：2 狼 2 民 + 预言家、女巫。屠城、无警长，用来快速体验流程。',
    tips: ['人少的时候可以用这个板子熟悉系统。'],
  },
];
