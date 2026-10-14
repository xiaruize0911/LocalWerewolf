import type { Ctx } from '../ctx.ts';
import type { PromptSpec, Seat } from '../types.ts';
import { aliveWith, noteCheck, otherWolvesAlive, othersAlive, readSeat, sideText } from './helpers.ts';
import { getRole } from './registry.ts';
import type { RoleDef } from './types.ts';

/** 机械狼学到的技能类型 */
type Skill = 'witch' | 'guard' | 'seer' | 'psychic' | 'hunter' | 'werewolf' | 'none';

function skillOf(ctx: Ctx, target: Seat): Skill {
  const role = ctx.player(target).role;
  if (role === 'witch' || role === 'guard' || role === 'seer' || role === 'psychic' || role === 'hunter') return role;
  if (role === 'gargoyle') return 'psychic';
  if (ctx.side(target) === 'wolf') return 'werewolf';
  return 'none';
}

const SKILL_TEXT: Record<Skill, string> = {
  witch: '一瓶毒药（仅一次），下一晚起可用',
  guard: '一次守护（可挡狼刀和毒药），下一晚起可用',
  seer: '每晚查验好人/狼人，下一晚起可用',
  psychic: '每晚查验具体身份，下一晚起可用',
  hunter: '出局时可以开枪，今晚起生效',
  werewolf: '一次「双刀」，获得狼刀后可用',
  none: '无技能',
};

function active(ctx: Ctx, seat: Seat): Skill | null {
  const f = ctx.player(seat).flags;
  if (!f.learnedSkill || f.learnNight >= ctx.s.night.night) return null;
  return f.learnedSkill;
}

function spec(ctx: Ctx, seat: Seat): PromptSpec {
  const f = ctx.player(seat).flags;
  const cands = othersAlive(ctx, seat);
  const knife = ctx.joinsWolfKill(seat) ? '你已获得狼刀。' : '其他狼人尚未全部出局，你还没有狼刀。';
  if (!f.learnedSkill) {
    const must = ctx.cfg('machineWolf').mustLearnFirstNight && ctx.s.night.night === 1;
    return { type: 'pickSeat', title: '选择学习一名玩家', desc: `学习后你会知道他的身份并获得对应技能，整局只能学一次。\n${knife}`, candidates: cands, allowSkip: !must, skipLabel: '暂不学习' };
  }
  const learned = `你学到的身份：${ctx.roleName(f.learned)}。`;
  switch (active(ctx, seat)) {
    case 'witch':
      if (!f.skillUsed) return { type: 'pickSeat', title: '是否使用毒药（仅一次）', desc: learned + knife, candidates: cands, allowSkip: true, skipLabel: '不使用' };
      break;
    case 'guard':
      if (!f.skillUsed) return { type: 'pickSeat', title: '是否使用守护（仅一次，可挡刀和毒）', desc: learned + knife, candidates: ctx.aliveSeats(), allowSkip: true, skipLabel: '不使用' };
      break;
    case 'seer':
      return { type: 'pickSeat', title: '请选择要查验（好人/狼人）的玩家', desc: learned + knife, candidates: cands, allowSkip: true, skipLabel: '不查验' };
    case 'psychic':
      return { type: 'pickSeat', title: '请选择要查验具体身份的玩家', desc: learned + knife, candidates: cands, allowSkip: true, skipLabel: '不查验' };
  }
  return { type: 'confirm', title: '机械狼', desc: `${learned}技能：${SKILL_TEXT[f.learnedSkill as Skill]}${f.skillUsed ? '（已用完）' : ''}。\n${knife}`, okLabel: '知道了' };
}

export const machineWolf: RoleDef = {
  id: 'machineWolf',
  name: '机械狼',
  faction: 'wolf',
  category: 'wolf',
  loneWolf: true,
  canExplode: false,
  short: '独自行动的狼，可以学习一名玩家的技能。',
  intro: {
    skill: '机械狼不与狼队见面，互相不知道身份，也不能自爆。任意一晚可以学习一名玩家（整局一次），当晚得知对方身份并获得技能：学女巫得一瓶毒药；学守卫得一次可挡刀挡毒的守护；学预言家/通灵师得每晚查验；学猎人得出局开枪；学狼人得一次「双刀」；学平民无技能。除猎人外，技能从下一晚开始可用。其他狼人全部出局后，机械狼获得狼刀。',
    timing: '每晚在狼人之后单独睁眼；获得狼刀后也会在「狼人」环节睁眼。',
    tips: [
      '首夜不学可以多听两轮发言再决定，但容易被通灵师首验验出「狼人」。',
      '学到狼人（双刀）后要尽量活到最后，双刀同一人可以无视解药和守护。',
      '学习后被通灵师查验显示为学到的身份，可以借此伪装。',
    ],
    interactions: [
      '通灵师查验未学习的机械狼显示为「狼人」。',
      '预言家查验机械狼始终显示为狼人。',
    ],
    variants: ['是否必须首夜学习'],
  },
  config: [
    { key: 'mustLearnFirstNight', group: '机械狼', label: '必须首夜学习', desc: '', type: 'select', default: false, options: [{ value: false, label: '否' }, { value: true, label: '是' }] },
  ],
  joinsWolfKill: (ctx, seat) => !otherWolvesAlive(ctx, seat),
  exactSees: (ctx, seat) => ctx.player(seat).flags.learned ?? 'werewolf',
  shooter: (ctx, seat) => ctx.player(seat).flags.learnedSkill === 'hunter',
  night: [
    {
      id: 'machineWolf', roles: ['machineWolf'], order: 95, name: '机械狼',
      actors: (ctx) => aliveWith(ctx, 'machineWolf'),
      spec,
      submit: (ctx, seat, payload) => {
        const p = ctx.player(seat);
        const f = p.flags;
        const n = ctx.s.night.night;
        const s = spec(ctx, seat);
        if (s.type !== 'pickSeat') return;
        const picked = readSeat(payload, s.candidates, !!s.allowSkip);
        const target = ctx.target(picked);
        if (!f.learnedSkill) {
          if (target == null) return '你今晚没有学习';
          f.learned = ctx.player(target).role;
          f.learnedSkill = skillOf(ctx, target);
          f.learnNight = f.learnedSkill === 'hunter' ? n - 1 : n;
          const text = `你学习了${picked}号，他的身份是${getRole(f.learned)?.name}。你获得：${SKILL_TEXT[f.learnedSkill as Skill]}`;
          ctx.tell(seat, `第${n}夜：${text}`);
          return text;
        }
        if (target == null) return '你今晚没有使用技能';
        switch (active(ctx, seat)) {
          case 'witch':
            f.skillUsed = true;
            ctx.s.night.machinePoison = target;
            ctx.tell(seat, `第${n}夜：你毒了${picked}号`);
            return `你对${picked}号使用了毒药`;
          case 'guard':
            f.skillUsed = true;
            ctx.s.night.machineGuard = target;
            ctx.tell(seat, `第${n}夜：你守护了${picked}号`);
            return `你守护了${picked}号`;
          case 'seer': {
            noteCheck(ctx, seat, target);
            const t = `${picked}号的身份是：${sideText(ctx.seerSees(target))}`;
            ctx.tell(seat, `第${n}夜查验：${t}`);
            return t;
          }
          case 'psychic': {
            const t = `${picked}号的身份是：${ctx.roleName(ctx.exactSees(target))}`;
            ctx.tell(seat, `第${n}夜查验：${t}`);
            return t;
          }
        }
      },
    },
  ],
};
