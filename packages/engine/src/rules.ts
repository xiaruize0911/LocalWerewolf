import type { Rules } from './types.ts';

export interface OptionDef {
  value: string | number | boolean;
  label: string;
}

export interface RuleDef {
  key: string;
  group: string;
  label: string;
  desc: string;
  type: 'select' | 'number';
  options?: OptionDef[];
  default: string | number | boolean;
  min?: number;
  max?: number;
  unit?: string;
  /** 冷门规则，默认折叠 */
  advanced?: boolean;
}

export const RULE_GROUPS = [
  'A. 胜负与基础',
  'B. 发言与遗言',
  'C. 女巫',
  'D. 守卫',
  'E. 狼人',
  'F. 开枪类（猎人、狼王）',
  'G. 警长细则',
  'H. 白痴与情侣',
  'I. 流程与语音',
] as const;

const yes = (label = '可以'): OptionDef => ({ value: true, label });
const no = (label = '不可以'): OptionDef => ({ value: false, label });

/**
 * 所有规则选项，按常见程度排序：组内越靠前越常见，每项的第一个选项是默认值。
 */
export const RULE_DEFS: RuleDef[] = [
  // ---------- A ----------
  { key: 'winMode', group: RULE_GROUPS[0], label: '胜利条件', default: 'edge',
    desc: '屠边：狼人杀光所有神职或所有平民即获胜；屠城：狼人需要杀光所有好人。',
    type: 'select', options: [{ value: 'edge', label: '屠边' }, { value: 'city', label: '屠城' }] },
  { key: 'sheriff', group: RULE_GROUPS[0], label: '警长', default: true,
    desc: '第一天白天先竞选警长。警长投票权重更高，并决定发言顺序、最后归票。',
    type: 'select', options: [yes('开启'), no('关闭')] },
  { key: 'sheriffVote', group: RULE_GROUPS[0], label: '警长票数', default: 1.5,
    desc: '网杀多为 1.5 票，面杀常用 2 票。',
    type: 'select', options: [{ value: 1.5, label: '1.5 票' }, { value: 2, label: '2 票' }] },
  { key: 'tieRule', group: RULE_GROUPS[0], label: '放逐平票', default: 'pk1',
    desc: '平票后进入 PK：平票玩家再发言一轮，由其余玩家投票。',
    type: 'select', options: [
      { value: 'pk1', label: 'PK 一轮，再平则平安日' },
      { value: 'none', label: '直接平安日' },
      { value: 'pk2', label: 'PK 两轮，仍平则平安日' },
    ] },
  { key: 'voteDetail', group: RULE_GROUPS[0], label: '投票明细', default: 'public',
    desc: '是否公开每个人投给了谁。',
    type: 'select', options: [{ value: 'public', label: '公开谁投了谁' }, { value: 'result', label: '只公开结果' }] },
  { key: 'deathCause', group: RULE_GROUPS[0], label: '死讯公布', default: 'hidden',
    desc: '标准规则只按座位号公布死者，不公布死因。',
    type: 'select', options: [{ value: 'hidden', label: '只报座位号' }, { value: 'public', label: '同时公布死因' }] },

  // ---------- B ----------
  { key: 'speech', group: RULE_GROUPS[1], label: '发言环节', default: 'on',
    desc: '开启：系统按顺序逐个点名发言。关闭：只提示自由讨论，房主点「开始投票」后进入投票。',
    type: 'select', options: [{ value: 'on', label: '开启（点名发言）' }, { value: 'off', label: '关闭（自由讨论）' }] },
  { key: 'speechReminder', group: RULE_GROUPS[1], label: '发言提醒', default: 0,
    desc: '0 表示不计时。大于 0 时仅在超过该秒数后提醒，不会强制结束发言。',
    type: 'number', min: 0, max: 600, unit: '秒' },
  { key: 'speechOrder', group: RULE_GROUPS[1], label: '无警长时的发言顺序', default: 'random',
    desc: '没有警长时从哪里开始发言。',
    type: 'select', options: [
      { value: 'random', label: '随机起点、随机方向' },
      { value: 'afterDeath', label: '从死者的下一位开始' },
      { value: 'fromOne', label: '从小号开始顺序发言' },
    ] },
  { key: 'sheriffSpeechOrder', group: RULE_GROUPS[1], label: '有警长时的发言顺序', default: 'sheriffChooses',
    desc: '警长选择从左边或右边开始，警长最后发言归票。',
    type: 'select', options: [
      { value: 'sheriffChooses', label: '警长选择顺序/逆序，最后归票' },
      { value: 'fixed', label: '从警长下一位顺序发言，警长最后' },
    ] },
  { key: 'lastWords', group: RULE_GROUPS[1], label: '遗言', default: 'firstNightAndDay',
    desc: '哪些死者可以发表遗言。',
    type: 'select', options: [
      { value: 'firstNightAndDay', label: '首夜死者 + 白天出局者' },
      { value: 'all', label: '所有死者都有' },
      { value: 'wolfCount', label: '几狼几遗言，用完为止' },
      { value: 'none', label: '没有遗言' },
    ] },
  { key: 'explodeLastWords', group: RULE_GROUPS[1], label: '自爆者遗言', default: true,
    desc: '狼人自爆后能否留遗言。',
    type: 'select', options: [yes('有'), no('无')] },

  // ---------- C ----------
  { key: 'witchSelfSave', group: RULE_GROUPS[2], label: '女巫自救', default: 'firstNight',
    desc: '被狼人刀中时，女巫能否用解药救自己。',
    type: 'select', options: [
      { value: 'firstNight', label: '仅首夜可以' },
      { value: 'never', label: '全程不能' },
      { value: 'always', label: '全程可以' },
    ] },
  { key: 'witchBothPotions', group: RULE_GROUPS[2], label: '一晚使用两瓶药', default: false,
    desc: '同一晚能否既救人又毒人。', type: 'select', options: [no(), yes()] },
  { key: 'witchKnowsAfterSave', group: RULE_GROUPS[2], label: '解药用完后是否告知刀口', default: false,
    desc: '解药用掉以后，法官是否还告诉女巫当晚谁被刀。',
    type: 'select', options: [no('不告知'), yes('仍告知')] },

  // ---------- D ----------
  { key: 'sameGuardSave', group: RULE_GROUPS[3], label: '同守同救', default: 'dies',
    desc: '守卫守护和女巫解药落在同一人身上时，两者效果抵消，该玩家仍然死亡。',
    type: 'select', options: [{ value: 'dies', label: '死亡' }, { value: 'lives', label: '存活' }] },
  { key: 'guardRepeat', group: RULE_GROUPS[3], label: '连续两晚守同一人', default: false,
    desc: '', type: 'select', options: [no(), yes()] },
  { key: 'guardSelf', group: RULE_GROUPS[3], label: '守卫自守', default: true,
    desc: '', type: 'select', options: [yes(), no()] },
  { key: 'guardEmpty', group: RULE_GROUPS[3], label: '守卫空守', default: true,
    desc: '', type: 'select', options: [yes(), no()] },

  // ---------- E ----------
  { key: 'wolfEmptyKill', group: RULE_GROUPS[4], label: '狼人空刀', default: true,
    desc: '狼人可以选择当晚不杀人。', type: 'select', options: [yes('允许'), no('不允许')] },
  { key: 'wolfSelfKill', group: RULE_GROUPS[4], label: '狼人自刀', default: true,
    desc: '狼人可以刀自己或狼队友。', type: 'select', options: [yes('允许'), no('不允许')] },
  { key: 'wolfDisagree', group: RULE_GROUPS[4], label: '狼队意见不统一', default: 'empty',
    desc: '行动时间结束时狼人仍未统一刀口的处理方式。',
    type: 'select', options: [
      { value: 'empty', label: '视为空刀' },
      { value: 'majority', label: '多数决定，平票空刀' },
      { value: 'random', label: '多数决定，平票随机' },
    ] },
  { key: 'explodeToNight', group: RULE_GROUPS[4], label: '自爆后', default: true,
    desc: '狼人白天自爆后是否立即进入黑夜。',
    type: 'select', options: [yes('直接入夜'), no('白天继续')] },

  // ---------- F ----------
  { key: 'shootWhenPoisoned', group: RULE_GROUPS[5], label: '被毒后开枪', default: false,
    desc: '猎人、狼王被女巫毒死后能否开枪。', type: 'select', options: [no('不能'), yes('可以')] },
  { key: 'shootWhenLover', group: RULE_GROUPS[5], label: '殉情后开枪', default: false,
    desc: '', type: 'select', options: [no('不能'), yes('可以')] },
  { key: 'shootWhenSameGuardSave', group: RULE_GROUPS[5], label: '同守同救死亡后开枪', default: true,
    desc: '同守同救视为被狼人杀死。', type: 'select', options: [yes('可以'), no('不能')] },
  { key: 'shootWhenTaken', group: RULE_GROUPS[5], label: '被白狼王带走后开枪', default: true,
    desc: '', type: 'select', options: [yes('可以'), no('不能')] },

  // ---------- G ----------
  { key: 'electionExplode', group: RULE_GROUPS[6], label: '竞选阶段有人自爆', default: 'lost',
    desc: '警长竞选期间狼人自爆，警徽如何处理。',
    type: 'select', options: [
      { value: 'lost', label: '单爆吞警徽：警徽直接流失' },
      { value: 'double', label: '双爆吞警徽：竞选顺延到第二天，再爆才流失' },
    ] },
  { key: 'withdrawnVote', group: RULE_GROUPS[6], label: '退水者能否投票', default: false,
    desc: '上警后又退水的玩家能否投警长票。', type: 'select', options: [no('不能'), yes('可以')] },
  { key: 'electionTie', group: RULE_GROUPS[6], label: '竞选平票', default: 'pk',
    desc: '', type: 'select', options: [
      { value: 'pk', label: 'PK 后再投，再平则警徽流失' },
      { value: 'lost', label: '直接流失' },
    ] },
  { key: 'badgeDestroy', group: RULE_GROUPS[6], label: '警长出局时撕警徽', default: true,
    desc: '警长出局时可以移交警徽，也可以撕毁。', type: 'select', options: [yes('可移交或撕毁'), no('只能移交')] },

  // ---------- H ----------
  { key: 'idiotLoseVote', group: RULE_GROUPS[7], label: '白痴翻牌后', default: true,
    desc: '白痴被放逐时翻牌免死，之后仍可发言。', type: 'select', options: [yes('失去投票权'), no('保留投票权')] },
  { key: 'idiotCountsAsGod', group: RULE_GROUPS[7], label: '翻牌白痴计入存活神职', default: true,
    desc: '屠边判定时，翻过牌的白痴是否算作一名存活的神。', type: 'select', options: [yes('是'), no('否')] },
  { key: 'humanWolfLovers', group: RULE_GROUPS[7], label: '人狼恋', default: 'third',
    desc: '丘比特连出一好一狼的情侣时，是否成为第三方阵营。',
    type: 'select', options: [
      { value: 'third', label: '情侣与丘比特成为第三方' },
      { value: 'ownSide', label: '各自随原阵营，仅殉情' },
    ], advanced: true },

  // ---------- I ----------
  { key: 'nightTimeout', group: RULE_GROUPS[8], label: '夜间行动时限', default: 60,
    desc: '超时按默认处理（不行动 / 狼队按规则处理）。', type: 'number', min: 15, max: 300, unit: '秒' },
  { key: 'voteTimeout', group: RULE_GROUPS[8], label: '投票时限', default: 60,
    desc: '超时未投视为弃票。', type: 'number', min: 10, max: 300, unit: '秒' },
  { key: 'skillTimeout', group: RULE_GROUPS[8], label: '白天技能时限', default: 30,
    desc: '开枪、移交警徽、上警等操作的时限。', type: 'number', min: 10, max: 300, unit: '秒' },
  { key: 'stepMin', group: RULE_GROUPS[8], label: '每个夜间步骤最短时长', default: 8,
    desc: '所有夜间步骤（包括已死或不存在的角色）至少持续这么久，再加随机时长，防止从时间上猜出身份。',
    type: 'number', min: 3, max: 60, unit: '秒', advanced: true },
  { key: 'stepJitter', group: RULE_GROUPS[8], label: '随机附加时长', default: 7,
    desc: '在最短时长基础上随机增加 0~N 秒。', type: 'number', min: 0, max: 60, unit: '秒', advanced: true },
  { key: 'callAbsentRoles', group: RULE_GROUPS[8], label: '唤醒板子上没有的常见神职', default: false,
    desc: '开启后，即使板子上没有守卫/女巫/预言家/猎人也会照常唤醒，用来迷惑。',
    type: 'select', options: [no('否'), yes('是')], advanced: true },
  { key: 'voiceMode', group: RULE_GROUPS[8], label: '语音播放', default: 'host',
    desc: '房主设备：由房主的浏览器（优先大屏页面）播放预生成的语音，房主不需要是运行服务器的电脑。服务器电脑：由运行服务器的 Mac 直接播放。',
    type: 'select', options: [{ value: 'host', label: '房主设备' }, { value: 'server', label: '运行服务器的电脑' }] },
  { key: 'voiceRate', group: RULE_GROUPS[8], label: '语速', default: 190,
    desc: '每分钟字数。只有默认语速 190 会提前生成全部语音，其他语速在第一次用到时生成。', type: 'number', min: 100, max: 320, advanced: true },
];

export function defaultRules(): Rules {
  const r: Rules = {};
  for (const d of RULE_DEFS) r[d.key] = d.default;
  return r;
}

export function normalizeRules(input: Partial<Rules> | undefined): Rules {
  const r = defaultRules();
  if (!input) return r;
  for (const d of RULE_DEFS) {
    const v = input[d.key];
    if (v === undefined) continue;
    if (d.type === 'number') {
      const n = Number(v);
      if (Number.isFinite(n)) r[d.key] = Math.min(d.max ?? Infinity, Math.max(d.min ?? -Infinity, n));
    } else if (d.options?.some((o) => o.value === v)) {
      r[d.key] = v;
    }
  }
  return r;
}
