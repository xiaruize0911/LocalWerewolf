import { createGame, dispatch, nextTimer } from '../src/engine.ts';
import { project } from '../src/view.ts';
import type { Board, Command, GameState, Payload, PromptSpec, RoleId, Rules, Seat } from '../src/types.ts';

export type NightPlan = Record<string, any>;
export interface DayPlan {
  /** 放逐投票：每个投票者 -> 目标；或一个数字表示所有人投同一人 */
  votes?: Record<Seat, Seat | null> | Seat;
  /** PK 轮投票 */
  pkVotes?: Record<Seat, Seat | null> | Seat;
  /** 上警的玩家 */
  run?: Seat[];
  electionVotes?: Record<Seat, Seat | null> | Seat;
  /** 死者开枪 */
  shoot?: Record<Seat, Seat | null>;
  badge?: Seat | null;
  sheriffOrder?: 'asc' | 'desc';
  /** 在某个时机执行的白天动作 */
  onSpeech?: (sim: Sim, speaker: Seat | null) => void;
}

export function toPayload(spec: PromptSpec, v: any): Payload {
  switch (spec.type) {
    case 'pickSeat': return { seat: v ?? null };
    case 'pickTwo': return { seats: v ?? null };
    case 'choice': return { value: v ?? spec.options[0].value };
    case 'form': return { values: v ?? {} };
    default: return {};
  }
}

const pickVote = (v: DayPlan['votes'], voter: Seat): Seat | null => {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  return v[voter] ?? null;
};

export class Sim {
  state: GameState;
  now = 1_000_000;
  nights: Record<number, NightPlan> = {};
  days: Record<number, DayPlan> = {};
  errors: string[] = [];
  announcements: string[] = [];
  /** 自定义应答（返回 undefined 时使用计划/默认） */
  responder?: (sim: Sim, seat: Seat, spec: PromptSpec) => Payload | undefined;

  constructor(o: { board?: Board; roles: RoleId[]; rules?: Partial<Rules>; roleConfig?: Record<string, any>; extraCards?: RoleId[]; seed?: string }) {
    const board: Board = o.board ?? {};
    if (!o.board) for (const r of [...o.roles, ...(o.extraCards ?? [])]) board[r] = (board[r] ?? 0) + 1;
    const roles: Record<Seat, RoleId> = {};
    o.roles.forEach((r, i) => (roles[i + 1] = r));
    const { state, effects } = createGame({
      players: o.roles.map((_, i) => ({ seat: i + 1, userId: i + 1, name: `P${i + 1}` })),
      board, rules: o.rules, roleConfig: o.roleConfig, seed: o.seed ?? 'test', now: this.now, roles, extraCards: o.extraCards, skipRoleCheck: true,
    });
    this.state = state;
    this.collect(effects);
  }

  private collect(effects: { t: string; [k: string]: any }[]) {
    for (const e of effects) {
      if (e.t === 'announce') this.announcements.push(e.text);
      if (e.t === 'error') this.errors.push(e.message);
    }
  }

  /** 发送命令；strict 时遇到规则错误直接抛出 */
  send(cmd: Command, strict = true) {
    const r = dispatch(this.state, cmd, this.now);
    const err = r.effects.find((e) => e.t === 'error');
    if (err && strict) throw new Error(`规则错误：${(err as any).message}`);
    this.collect(r.effects);
    this.state = r.state;
    return err ? (err as any).message as string : null;
  }

  get s() {
    return this.state;
  }
  alive(seat: Seat) {
    return this.state.players.find((p) => p.seat === seat)!.alive;
  }
  dead(): Seat[] {
    return this.state.players.filter((p) => !p.alive).map((p) => p.seat);
  }
  role(seat: Seat) {
    return this.state.players.find((p) => p.seat === seat)!.role;
  }
  view(seat: Seat | null) {
    return project(this.state, seat);
  }
  info(seat: Seat): string[] {
    return this.view(seat).me!.info.map((x) => x.text);
  }

  private answer(seat: Seat, spec: PromptSpec, purpose: string): Payload {
    const custom = this.responder?.(this, seat, spec);
    if (custom) return custom;
    const s = this.state;
    const cur = s.current!;
    if (cur.kind === 'nightAct') {
      const plan = this.nights[s.night.night] ?? {};
      const v = plan[cur.id];
      if (v !== undefined) {
        const val = typeof v === 'object' && v !== null && !Array.isArray(v) && 'bySeat' in v ? v.bySeat[seat] : v;
        return toPayload(spec, val);
      }
      return toPayload(spec, spec.type === 'pickSeat' && !spec.allowSkip ? spec.candidates[0] : spec.type === 'pickTwo' && !spec.allowSkip ? spec.candidates.slice(0, 2) : undefined);
    }
    const day = this.days[s.day] ?? {};
    switch (purpose) {
      case 'vote':
        return { seat: pickVote(cur.round > 1 ? day.pkVotes ?? day.votes : day.votes, seat) };
      case 'electionVote':
        return { seat: pickVote(day.electionVotes, seat) };
      case 'signup':
        return { value: day.run?.includes(seat) ? 'run' : 'no' };
      case 'deathSkill':
        return spec.type === 'pickSeat' ? { seat: day.shoot?.[seat] ?? null } : {};
      case 'badge':
        return { seat: day.badge ?? null };
      case 'sheriffOrder':
        return { value: day.sheriffOrder ?? 'asc' };
      default:
        return toPayload(spec, undefined);
    }
  }

  /** 推进一步：确认公告 / 回答提示 / 结束发言 / 推进时间 */
  stepOnce(): boolean {
    const s = this.state;
    if (s.phase === 'over') return false;
    if (s.announce) {
      this.send({ t: 'announceDone', id: s.announce.id });
      return true;
    }
    for (const p of s.prompts) {
      if (p.closed) continue;
      for (const seat of p.seats) {
        if (p.responses[seat]) continue;
        const payload = this.answer(seat, p.specs[seat], p.purpose);
        this.send({ t: 'submit', seat, promptId: p.id, payload });
        return true;
      }
    }
    const cur = s.current;
    if (cur?.kind === 'speech' || cur?.kind === 'freeTalk') {
      const plan = this.days[s.day];
      plan?.onSpeech?.(this, cur.kind === 'speech' ? cur.seat : null);
      if (this.state !== s) return true;
      if (cur.kind === 'speech') this.send({ t: 'speechEnd', seat: cur.seat });
      else this.send({ t: 'host', action: 'startVote' });
      return true;
    }
    const t = nextTimer(s);
    if (t == null) throw new Error(`游戏卡住了：${JSON.stringify(s.current)}`);
    this.now = Math.max(this.now, t);
    this.send({ t: 'tick' });
    return true;
  }

  runUntil(pred: (s: GameState) => boolean, max = 20000) {
    for (let i = 0; i < max; i++) {
      if (pred(this.state)) return this;
      if (!this.stepOnce()) return this;
    }
    throw new Error('runUntil 超出步数');
  }

  /** 运行到第 n 天公布死讯之后 */
  toDay(n: number) {
    return this.runUntil((s) => s.phase === 'over' || (s.day === n && s.phase === 'day' && s.log.some((l) => l.day === n && /昨晚/.test(l.text))));
  }
  toNight(n: number) {
    return this.runUntil((s) => s.phase === 'over' || (s.day === n && s.phase === 'night'));
  }
  toEnd() {
    return this.runUntil((s) => s.phase === 'over');
  }
}
