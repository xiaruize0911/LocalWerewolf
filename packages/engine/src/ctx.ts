import { nextFloat, shuffleInPlace } from './rng.ts';
import type {
  Audience, Effect, GameState, Player, Prompt, PromptSpec, RoleId, Seat, Step,
} from './types.ts';
import { getRole } from './roles/registry.ts';
import type { RoleDef } from './roles/types.ts';

/** 非法操作：返回给提交者的错误提示 */
export class RuleError extends Error {}

/**
 * 一次 dispatch 期间的上下文：持有可变的 state 克隆、当前时间和收集到的副作用。
 * 角色代码只通过它读写游戏状态。
 */
export class Ctx {
  effects: Effect[] = [];
  s: GameState;
  now: number;
  constructor(s: GameState, now: number) {
    this.s = s;
    this.now = now;
  }

  get rules() {
    return this.s.rules;
  }

  cfg(roleId: RoleId): Record<string, any> {
    const def = getRole(roleId);
    const out: Record<string, any> = {};
    for (const c of def?.config ?? []) out[c.key] = c.default;
    return { ...out, ...(this.s.roleConfig[roleId] ?? {}) };
  }

  // ---------- 随机 ----------
  rand(): number {
    return nextFloat(this.s.rng);
  }
  randInt(n: number): number {
    return Math.floor(this.rand() * n);
  }
  pick<T>(arr: T[]): T {
    return arr[this.randInt(arr.length)];
  }
  shuffle<T>(arr: T[]): T[] {
    return shuffleInPlace(this.s.rng, arr);
  }

  // ---------- 玩家 ----------
  player(seat: Seat): Player {
    const p = this.s.players.find((x) => x.seat === seat);
    if (!p) throw new RuleError(`没有 ${seat} 号玩家`);
    return p;
  }
  alive(seat: Seat): boolean {
    return this.s.players.some((p) => p.seat === seat && p.alive);
  }
  aliveSeats(): Seat[] {
    return this.s.players.filter((p) => p.alive).map((p) => p.seat);
  }
  allSeats(): Seat[] {
    return this.s.players.map((p) => p.seat);
  }
  roleOf(seat: Seat): RoleDef {
    return getRole(this.player(seat).role)!;
  }
  seatsOf(roleId: RoleId, aliveOnly = true): Seat[] {
    return this.s.players.filter((p) => p.role === roleId && (!aliveOnly || p.alive)).map((p) => p.seat);
  }
  /** 板子上（含盗贼底牌）是否有该角色 */
  onBoard(roleId: RoleId): boolean {
    return (this.s.board[roleId] ?? 0) > 0;
  }

  /** 基础阵营（不含情侣第三方），预言家等据此判断 */
  side(seat: Seat): 'good' | 'wolf' {
    const role = this.roleOf(seat);
    if (role.side) return role.side(this, seat);
    return role.faction === 'wolf' ? 'wolf' : 'good';
  }
  /** 预言家视角 */
  seerSees(seat: Seat): 'good' | 'wolf' {
    const role = this.roleOf(seat);
    return role.seerSees ? role.seerSees(this, seat) : this.side(seat);
  }
  /** 通灵师、石像鬼视角：具体身份 */
  exactSees(seat: Seat): RoleId {
    const role = this.roleOf(seat);
    return role.exactSees ? role.exactSees(this, seat) : role.id;
  }
  /** 胜负判定用的阵营（人狼恋情侣为第三方） */
  team(seat: Seat): 'good' | 'wolf' | 'third' {
    const lovers: Seat[] | undefined = this.s.roleState.cupid?.lovers;
    if (lovers && this.s.roleState.cupid?.third) {
      if (lovers.includes(seat)) return 'third';
      if (this.player(seat).role === 'cupid') return 'third';
    }
    return this.side(seat);
  }
  /** 屠边计数：wolf / god / villager / null(不计入) */
  countsAs(seat: Seat): 'wolf' | 'god' | 'villager' | null {
    if (this.team(seat) === 'third') return null;
    const role = this.roleOf(seat);
    if (role.countsAs) return role.countsAs(this, seat);
    if (role.category === 'wolf') return 'wolf';
    if (role.category === 'god') return 'god';
    if (role.category === 'villager') return 'villager';
    return null;
  }
  /** 当晚参与狼刀 */
  joinsWolfKill(seat: Seat): boolean {
    const role = this.roleOf(seat);
    if (role.joinsWolfKill) return role.joinsWolfKill(this, seat);
    return !!role.wolfTeam;
  }
  /** 夜间互相可见的狼队成员（含死亡的） */
  wolfTeamSeats(): Seat[] {
    return this.s.players.filter((p) => getRole(p.role)?.wolfTeam || p.flags.convertedWolf).map((p) => p.seat);
  }
  /** 是否在今晚被恐惧/封印而无法行动 */
  isBlocked(seat: Seat): boolean {
    if (this.s.night.fear === seat) return true;
    if (this.s.night.sealGood && this.side(seat) === 'good') return true;
    return false;
  }
  /** 魔术师交换后的真实目标 */
  target(seat: Seat | null): Seat | null {
    if (seat == null) return null;
    const sw = this.s.night.swap;
    if (!sw) return seat;
    if (seat === sw[0]) return sw[1];
    if (seat === sw[1]) return sw[0];
    return seat;
  }

  /** 角色的持久状态 */
  rs(key: string): Record<string, any> {
    return (this.s.roleState[key] ??= {});
  }

  roleName(roleId: RoleId): string {
    return getRole(roleId)?.name ?? roleId;
  }

  // ---------- 日志 ----------
  log(text: string, to: Audience = 'all') {
    this.s.log.push({ id: ++this.s.seq, day: this.s.day, phase: this.s.phase, text, to });
  }
  tell(seat: Seat, text: string) {
    this.log(text, [seat]);
  }

  id(prefix: string): string {
    return `${prefix}${++this.s.seq}`;
  }

  // ---------- 计时 ----------
  timer(id: string, ms: number) {
    this.s.timers[id] = this.now + ms;
  }
  clearTimer(id: string) {
    delete this.s.timers[id];
  }

  // ---------- 流程 ----------
  stage(text: string) {
    this.s.stage = text;
  }
  /** 插入到议程最前面（按给定顺序） */
  pushFront(...steps: Step[]) {
    this.s.agenda.unshift(...steps);
  }

  openPrompt(p: {
    purpose: string;
    seats: Seat[];
    spec: PromptSpec | ((seat: Seat) => PromptSpec);
    group?: boolean;
    timeoutSec?: number;
  }): Prompt {
    const specs: Record<Seat, PromptSpec> = {};
    for (const seat of p.seats) specs[seat] = typeof p.spec === 'function' ? p.spec(seat) : p.spec;
    const prompt: Prompt = {
      id: this.id('p'),
      purpose: p.purpose,
      seats: [...p.seats],
      specs,
      responses: {},
      feedback: {},
      group: p.group,
    };
    if (p.timeoutSec) {
      prompt.deadline = this.now + p.timeoutSec * 1000;
      this.s.timers[`deadline:${prompt.id}`] = prompt.deadline;
    }
    this.s.prompts.push(prompt);
    return prompt;
  }
  closePrompt(prompt: Prompt) {
    prompt.closed = true;
    delete this.s.timers[`deadline:${prompt.id}`];
  }
  findPrompt(purpose: string): Prompt | undefined {
    return this.s.prompts.find((p) => p.purpose === purpose && !p.closed);
  }

  announce(text: string): Step {
    return { kind: 'announce', text };
  }
}

export function seatList(seats: Seat[]): string {
  return seats.map((s) => `${s}号`).join('、');
}
