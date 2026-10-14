import { RuleError, type Ctx } from '../ctx.ts';
import type { Payload, PromptSpec, RoleId, Seat } from '../types.ts';
import type { NightAction } from './types.ts';

export const aliveWith = (ctx: Ctx, roleId: RoleId) => ctx.seatsOf(roleId, true);
export const othersAlive = (ctx: Ctx, seat: Seat) => ctx.aliveSeats().filter((s) => s !== seat);

/** 从 pickSeat 提交中取出座位并校验 */
export function readSeat(payload: Payload, candidates: Seat[], allowSkip: boolean): Seat | null {
  const v = payload?.seat;
  if (v == null) {
    if (!allowSkip) throw new RuleError('必须选择一名玩家');
    return null;
  }
  const seat = Number(v);
  if (!candidates.includes(seat)) throw new RuleError('不能选择该玩家');
  return seat;
}

interface TargetOpts {
  id: string;
  role: RoleId;
  order: number;
  name: string;
  title: string | ((ctx: Ctx, seat: Seat) => string);
  desc?: (ctx: Ctx, seat: Seat) => string | undefined;
  candidates?: (ctx: Ctx, seat: Seat) => Seat[];
  allowSkip?: boolean | ((ctx: Ctx, seat: Seat) => boolean);
  skipLabel?: string;
  firstNightOnly?: boolean;
  fromNight?: number;
  /** 记录选择（target 已经过魔术师映射；picked 为原始选择），返回反馈 */
  record: (ctx: Ctx, seat: Seat, target: Seat | null, picked: Seat | null) => string | void;
  timeout?: (ctx: Ctx, seat: Seat) => string | void;
}

/** 最常见的夜间行动：选一个目标 */
export function targetAction(o: TargetOpts): NightAction {
  const cands = (ctx: Ctx, seat: Seat) => (o.candidates ? o.candidates(ctx, seat) : othersAlive(ctx, seat));
  const skip = (ctx: Ctx, seat: Seat) => (typeof o.allowSkip === 'function' ? o.allowSkip(ctx, seat) : o.allowSkip ?? true);
  return {
    id: o.id,
    roles: [o.role],
    order: o.order,
    name: o.name,
    firstNightOnly: o.firstNightOnly,
    fromNight: o.fromNight,
    actors: (ctx) => aliveWith(ctx, o.role),
    spec: (ctx, seat): PromptSpec => ({
      type: 'pickSeat',
      title: typeof o.title === 'function' ? o.title(ctx, seat) : o.title,
      desc: o.desc?.(ctx, seat),
      candidates: cands(ctx, seat),
      allowSkip: skip(ctx, seat),
      skipLabel: o.skipLabel ?? '不使用',
    }),
    submit: (ctx, seat, payload) => {
      const picked = readSeat(payload, cands(ctx, seat), skip(ctx, seat));
      return o.record(ctx, seat, ctx.target(picked), picked);
    },
    timeout: o.timeout,
  };
}

/** 只需睁眼示意的步骤（白痴、骑士首夜等） */
export function wakeOnly(o: {
  id: string; role: RoleId; order: number; name: string;
  firstNightOnly?: boolean;
  desc?: (ctx: Ctx, seat: Seat) => string;
}): NightAction {
  return {
    id: o.id,
    roles: [o.role],
    order: o.order,
    name: o.name,
    firstNightOnly: o.firstNightOnly,
    actors: (ctx) => aliveWith(ctx, o.role),
    spec: (ctx, seat) => ({ type: 'confirm', title: `你是${ctx.roleName(o.role)}`, desc: o.desc?.(ctx, seat), okLabel: '知道了' }),
    submit: () => {},
  };
}

export const sideText = (s: 'good' | 'wolf') => (s === 'wolf' ? '狼人' : '好人');

/** 恶灵骑士反伤：记录查验 */
export function noteCheck(ctx: Ctx, by: Seat, target: Seat) {
  ctx.s.night.checks.push({ by, target });
}

/** 板子上除自己外仍存活的狼（不含孤狼类：机械狼、石像鬼） */
export function otherWolvesAlive(ctx: Ctx, seat: Seat): boolean {
  return ctx.aliveSeats().some((s) => {
    if (s === seat) return false;
    const r = ctx.roleOf(s);
    if (r.loneWolf) return false;
    return ctx.countsAs(s) === 'wolf';
  });
}
