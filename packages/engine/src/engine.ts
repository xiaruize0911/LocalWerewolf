import { Ctx, RuleError } from './ctx.ts';
import { dayAction, endGame } from './day/day.ts';
import { freshNight } from './night/schedule.ts';
import { getRole } from './roles/registry.ts';
import { seedRng, shuffleInPlace } from './rng.ts';
import { normalizeRules } from './rules.ts';
import { endCurrent, route, run } from './steps.ts';
import type { Board, Command, Effect, GameState, Player, PlayerInit, RoleId, Rules, Seat } from './types.ts';

export interface CreateOptions {
  id?: string;
  players: PlayerInit[];
  board: Board;
  rules?: Partial<Rules>;
  roleConfig?: Record<RoleId, Record<string, any>>;
  /** 随机种子（服务器用 crypto 生成） */
  seed: string | number[];
  now: number;
  /** 测试用：指定每个座位的身份 */
  roles?: Record<Seat, RoleId>;
  extraCards?: RoleId[];
  /** 测试用：跳过「查看身份」确认 */
  skipRoleCheck?: boolean;
}

export function boardSize(board: Board): number {
  return Object.values(board).reduce((a, b) => a + (b > 0 ? b : 0), 0);
}

/** 校验配板，返回错误文案；合法时返回 null */
export function validateBoard(board: Board, playerCount: number): string | null {
  for (const [id, n] of Object.entries(board)) {
    if (!getRole(id)) return `未知角色：${id}`;
    if (!Number.isInteger(n) || n < 0) return '角色数量必须是非负整数';
  }
  const thief = (board.thief ?? 0) > 0;
  if ((board.thief ?? 0) > 1) return '盗贼最多只能有一个';
  const need = playerCount + (thief ? 2 : 0);
  const total = boardSize(board);
  if (total !== need) return thief ? `有盗贼时需要 ${need} 张牌（人数 + 2），当前 ${total} 张` : `角色总数（${total}）需要等于人数（${playerCount}）`;
  if (playerCount < 4) return '至少需要 4 名玩家';
  const wolves = Object.entries(board).filter(([id, n]) => n > 0 && getRole(id)!.faction === 'wolf').reduce((a, [, n]) => a + n, 0);
  if (wolves < 1) return '至少需要一名狼人阵营角色';
  if (wolves >= playerCount) return '狼人数量过多';
  if ((board.cupid ?? 0) > 1) return '丘比特最多只能有一个';
  return null;
}

export function createGame(o: CreateOptions): { state: GameState; effects: Effect[] } {
  const err = validateBoard(o.board, o.players.length);
  if (err) throw new RuleError(err);
  const rules = normalizeRules(o.rules);
  const rng = seedRng(o.seed);
  const seats = [...o.players].sort((a, b) => a.seat - b.seat);

  let assigned: RoleId[];
  let extra: RoleId[] = [];
  if (o.roles) {
    assigned = seats.map((p) => o.roles![p.seat]);
    extra = o.extraCards ?? [];
  } else {
    const deck: RoleId[] = [];
    for (const [id, n] of Object.entries(o.board)) for (let i = 0; i < n; i++) deck.push(id);
    shuffleInPlace(rng, deck);
    assigned = deck.slice(0, seats.length);
    extra = deck.slice(seats.length);
  }

  const players: Player[] = seats.map((p, i) => ({
    ...p,
    role: assigned[i],
    initialRole: assigned[i],
    alive: true,
    flags: {},
  }));
  const wolvesOnBoard = Object.entries(o.board).filter(([id]) => getRole(id)!.faction === 'wolf').reduce((a, [, n]) => a + n, 0);

  const state: GameState = {
    id: o.id ?? `g${o.now}`,
    board: { ...o.board },
    rules,
    roleConfig: o.roleConfig ?? {},
    players,
    extraCards: extra,
    phase: 'night',
    day: 0,
    stage: '准备开始',
    agenda: o.skipRoleCheck ? [{ kind: 'nightStart' }] : [{ kind: 'roleCheck' }, { kind: 'nightStart' }],
    current: null,
    prompts: [],
    timers: {},
    announce: null,
    night: freshNight(0),
    prevNight: null,
    roleState: {},
    pendingDeaths: [],
    sheriff: null,
    election: { status: 'notYet', candidates: [], withdrawn: [], explodes: 0 },
    speech: null,
    lastWordsLeft: wolvesOnBoard,
    lastExiled: null,
    votes: [],
    log: [],
    seq: 0,
    paused: null,
    winner: null,
    rng,
  };
  const ctx = new Ctx(state, o.now);
  ctx.log(`游戏开始，共 ${players.length} 名玩家`);
  run(ctx);
  return { state, effects: ctx.effects };
}

/** 处理一条命令。非法命令返回原状态和一个 error 副作用 */
export function dispatch(state: GameState, cmd: Command, now: number): { state: GameState; effects: Effect[] } {
  if (state.phase === 'over') return { state, effects: [] };
  const s: GameState = structuredClone(state);
  const ctx = new Ctx(s, now);
  try {
    handle(ctx, cmd);
    run(ctx);
  } catch (e) {
    if (e instanceof RuleError) {
      return { state, effects: [{ t: 'error', seat: 'seat' in cmd ? cmd.seat : undefined, message: e.message }] };
    }
    throw e;
  }
  return { state: s, effects: ctx.effects };
}

function handle(ctx: Ctx, cmd: Command) {
  const s = ctx.s;
  if (cmd.t === 'host') {
    switch (cmd.action) {
      case 'pause':
        if (!s.paused) s.paused = ctx.now;
        return;
      case 'resume':
        if (s.paused) {
          const d = ctx.now - s.paused;
          for (const k of Object.keys(s.timers)) s.timers[k] += d;
          for (const p of s.prompts) if (p.deadline) p.deadline += d;
          s.paused = null;
        }
        return;
      case 'abort':
        endCurrent(ctx);
        endGame(ctx, 'aborted', '房主终止了游戏');
        return;
    }
  }
  if (s.paused) throw new RuleError('游戏已暂停');

  switch (cmd.t) {
    case 'tick': {
      const due = Object.entries(s.timers).filter(([, at]) => at <= ctx.now).sort((a, b) => a[1] - b[1]);
      for (const [id] of due) {
        if (!(id in s.timers) || s.timers[id] > ctx.now) continue;
        delete s.timers[id];
        if (id.startsWith('deadline:')) {
          const prompt = s.prompts.find((p) => p.id === id.slice(9));
          if (prompt && !prompt.closed) route(ctx, { t: 'deadline', prompt });
        } else {
          route(ctx, { t: 'timer', id });
        }
        run(ctx);
      }
      return;
    }
    case 'announceDone':
      if (s.announce?.id === cmd.id) route(ctx, { t: 'announceDone' });
      return;
    case 'submit': {
      const prompt = s.prompts.find((p) => p.id === cmd.promptId);
      if (!prompt || prompt.closed) throw new RuleError('该操作已结束');
      if (!prompt.seats.includes(cmd.seat)) throw new RuleError('现在不需要你操作');
      if (prompt.responses[cmd.seat] && !prompt.group) throw new RuleError('你已经提交过了');
      const payload = cmd.payload ?? {};
      if (prompt.purpose !== 'night') prompt.responses[cmd.seat] = payload;
      route(ctx, { t: 'submit', prompt, seat: cmd.seat, payload });
      return;
    }
    case 'speechEnd':
      route(ctx, { t: 'speechEnd', seat: cmd.seat });
      return;
    case 'dayAction':
      dayAction(ctx, cmd.seat, cmd.action, cmd.target);
      return;
    case 'host':
      if (cmd.action === 'skipAllSpeech' || cmd.action === 'startVote') {
        const cur = s.current;
        if (cur && (cur.kind === 'speech' || cur.kind === 'freeTalk' || (cur.kind === 'announce' && cur.group))) {
          const g = cur.group;
          s.agenda = s.agenda.filter((st) => st.group !== g);
          endCurrent(ctx);
        }
        return;
      }
      route(ctx, { t: 'host', action: cmd.action as 'nextSpeaker' | 'advance' });
      return;
  }
}

/** 下一个需要触发 tick 的时间（毫秒时间戳），没有则为 null */
export function nextTimer(state: GameState): number | null {
  if (state.paused || state.phase === 'over') return null;
  const ts = Object.values(state.timers);
  return ts.length ? Math.min(...ts) : null;
}
