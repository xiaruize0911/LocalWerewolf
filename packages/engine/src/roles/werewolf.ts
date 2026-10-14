import { RuleError, seatList, type Ctx } from '../ctx.ts';
import type { Payload, PromptSpec, Seat } from '../types.ts';
import type { NightAction, RoleDef } from './types.ts';

/** 所有可能参与狼刀的角色：板子上有任意一个就会唤醒「狼人」 */
export const WOLF_KILL_ROLES = [
  'werewolf', 'wolfKing', 'whiteWolfKing', 'wolfBeauty', 'evilKnight', 'nightmare', 'bloodMoon',
  'hiddenWolf', 'machineWolf', 'gargoyle',
];

function doubleKnifeReady(ctx: Ctx, seat: Seat): boolean {
  const p = ctx.player(seat);
  return p.role === 'machineWolf' && p.flags.learnedSkill === 'werewolf'
    && p.flags.learnNight < ctx.s.night.night && !p.flags.doubleUsed;
}

function killCandidates(ctx: Ctx, actors: Seat[]): Seat[] {
  if (ctx.rules.wolfSelfKill) return ctx.aliveSeats();
  const team = new Set([...actors, ...ctx.wolfTeamSeats()]);
  return ctx.aliveSeats().filter((s) => !team.has(s));
}

const key = (p: Payload | undefined): string => {
  if (!p) return '';
  if (p.values) return `${p.values.target ?? '-'}/${p.values.target2 ?? '-'}`;
  return String(p.seat ?? '-');
};

export const wolvesAction: NightAction = {
  id: 'wolves',
  roles: [...WOLF_KILL_ROLES, 'wildChild'],
  order: 70,
  name: '狼人',
  group: true,
  actors: (ctx) => ctx.aliveSeats().filter((s) => ctx.joinsWolfKill(s)),
  spec: (ctx, seat): PromptSpec => {
    const actors = ctx.aliveSeats().filter((s) => ctx.joinsWolfKill(s) && !ctx.isBlocked(s));
    const mates = actors.filter((s) => s !== seat);
    const desc = mates.length ? `今晚一起行动的狼队友：${seatList(mates)}。需要全部狼人选择同一目标。` : '你独自行动。';
    const candidates = killCandidates(ctx, actors);
    if (doubleKnifeReady(ctx, seat)) {
      return {
        type: 'form', title: '请选择袭击目标', desc: `${desc}\n你可以使用一次「双刀」：两刀落在同一人身上时无视解药与守护。`,
        fields: [
          { key: 'target', label: '第一刀', kind: 'seat', candidates, optional: !!ctx.rules.wolfEmptyKill },
          { key: 'target2', label: '双刀（仅一次，可不选）', kind: 'seat', candidates, optional: true },
        ],
        okLabel: '确认',
      };
    }
    return {
      type: 'pickSeat', title: '请选择今晚袭击的目标', desc, candidates,
      allowSkip: !!ctx.rules.wolfEmptyKill, skipLabel: '空刀',
    };
  },
  submit: (ctx, seat, payload) => {
    const actors = ctx.aliveSeats().filter((s) => ctx.joinsWolfKill(s));
    const candidates = killCandidates(ctx, actors);
    const check = (v: any, optional: boolean) => {
      if (v == null) {
        if (!optional) throw new RuleError('不允许空刀');
        return;
      }
      if (!candidates.includes(Number(v))) throw new RuleError('不能选择该玩家');
    };
    if (payload.values) {
      if (!doubleKnifeReady(ctx, seat)) throw new RuleError('无法使用双刀');
      check(payload.values.target, !!ctx.rules.wolfEmptyKill);
      check(payload.values.target2, true);
    } else {
      check(payload.seat, !!ctx.rules.wolfEmptyKill);
    }
  },
  finish: (ctx, responses, timedOut) => {
    const actors = ctx.aliveSeats().filter((s) => ctx.joinsWolfKill(s) && !ctx.isBlocked(s));
    const given = actors.filter((s) => responses[s]).map((s) => ({ seat: s, k: key(responses[s]), p: responses[s] }));
    let chosen: Payload | null = null;
    const unanimous = given.length === actors.length && given.length > 0 && given.every((g) => g.k === given[0].k);
    if (unanimous) chosen = given[0].p;
    else if (timedOut && given.length && ctx.rules.wolfDisagree !== 'empty') {
      const counts = new Map<string, { n: number; p: Payload }>();
      for (const g of given) {
        const c = counts.get(g.k) ?? { n: 0, p: g.p };
        c.n++;
        counts.set(g.k, c);
      }
      const max = Math.max(...[...counts.values()].map((c) => c.n));
      const top = [...counts.values()].filter((c) => c.n === max);
      if (top.length === 1) chosen = top[0].p;
      else if (ctx.rules.wolfDisagree === 'random') chosen = ctx.pick(top).p;
    }
    let t1: Seat | null = null;
    let t2: Seat | null = null;
    if (chosen?.values) {
      t1 = chosen.values.target ?? null;
      t2 = chosen.values.target2 ?? null;
      if (t2 != null) {
        const m = actors.find((s) => doubleKnifeReady(ctx, s));
        if (m) ctx.player(m).flags.doubleUsed = true;
        if (t1 == null) [t1, t2] = [t2, null];
      }
    } else if (chosen) {
      t1 = chosen.seat ?? null;
    }
    ctx.s.night.wolfKill = ctx.target(t1 == null ? null : Number(t1));
    ctx.s.night.wolfKill2 = ctx.target(t2 == null ? null : Number(t2));
    const text = t1 == null ? '狼队今晚空刀' : `狼队今晚袭击了${t1}号${t2 != null ? `，双刀袭击了${t2}号` : ''}`;
    ctx.log(text, actors.length ? actors : 'wolves');
  },
};

export const werewolf: RoleDef = {
  id: 'werewolf',
  name: '狼人',
  faction: 'wolf',
  category: 'wolf',
  wolfTeam: true,
  canExplode: true,
  short: '每晚与狼队友商量，共同袭击一名玩家。',
  intro: {
    skill: '每晚和狼队友一起睁眼，统一选择一名玩家袭击。白天可以伪装成好人，也可以在白天自爆，直接结束当天进入黑夜。',
    timing: '每晚，守卫之后行动。',
    tips: [
      '狼队需要所有成员选同一个目标，手机上能实时看到队友的选择。',
      '白天要伪装好身份，可以考虑悍跳预言家来混淆视听。',
      '自爆会让自己出局，但能打断白天的发言和投票。',
    ],
    interactions: ['被守卫守护或被女巫解药救下的目标不会死亡（同守同救除外）。'],
    variants: ['是否允许空刀、自刀', '意见不统一时的处理'],
  },
  night: [wolvesAction],
};
