import { Ctx } from './ctx.ts';
import { canDuelNow, canExplodeNow, canWithdrawNow } from './day/day.ts';
import { getRole } from './roles/registry.ts';
import type { Board, GameState, Payload, Phase, PromptSpec, RoleId, Rules, Seat, VoteRecord } from './types.ts';

export interface PublicPlayer {
  seat: Seat;
  name: string;
  alive: boolean;
  isBot?: boolean;
  sheriff: boolean;
  /** 已公开的身份（翻牌白痴、游戏结束） */
  revealed?: RoleId;
}

export interface PromptView {
  id: string;
  spec: PromptSpec;
  deadline?: number;
  submitted: boolean;
  response?: Payload;
  feedback?: string;
  closed: boolean;
  /** 狼队友的实时选择 */
  intents?: Record<Seat, Payload>;
}

export interface MeView {
  seat: Seat;
  role: RoleId;
  roleName: string;
  initialRole: RoleId;
  side: 'good' | 'wolf';
  alive: boolean;
  /** 狼队友（夜间互相可见的） */
  wolfTeam: Seat[];
  lover: Seat | null;
  thirdTeam: boolean;
  info: { day: number; phase: Phase; text: string }[];
}

export interface GameView {
  id: string;
  phase: Phase;
  day: number;
  stage: string;
  paused: boolean;
  announce: string | null;
  board: Board;
  rules: Rules;
  players: PublicPlayer[];
  sheriff: Seat | null;
  election: { status: string; candidates: Seat[]; withdrawn: Seat[] };
  speech: { seat: Seat | null; label: string } | null;
  me: MeView | null;
  prompt: PromptView | null;
  actions: { explode: boolean; duel: boolean; withdraw: boolean };
  log: { id: number; day: number; phase: Phase; text: string }[];
  votes: VoteRecord[];
  winner: GameState['winner'];
  /** 游戏结束后的全部身份 */
  reveal: { seat: Seat; role: RoleId; initialRole: RoleId; alive: boolean; deathCause?: string; team: string }[] | null;
}

/**
 * 为某个视角生成视图。seat 为 null 表示大屏（只含公开信息）。
 * 这是唯一把隐藏信息对外输出的地方。
 */
export function project(state: GameState, seat: Seat | null): GameView {
  const ctx = new Ctx(state, Date.now());
  const s = state;
  const over = s.phase === 'over';
  const me = seat != null ? s.players.find((p) => p.seat === seat) ?? null : null;

  const players: PublicPlayer[] = s.players.map((p) => ({
    seat: p.seat,
    name: p.name,
    alive: p.alive,
    isBot: p.isBot,
    sheriff: s.sheriff === p.seat,
    revealed: over ? p.role : p.flags.flipped ? p.role : undefined,
  }));

  let meView: MeView | null = null;
  let promptView: PromptView | null = null;
  if (me) {
    const role = getRole(me.role)!;
    const inWolfTeam = !!(role.wolfTeam || me.flags.convertedWolf || role.seesWolfTeam);
    const lovers: Seat[] | undefined = s.roleState.cupid?.lovers;
    const knowsLover = lovers?.includes(me.seat) && s.log.some((l) => Array.isArray(l.to) && l.to.includes(me.seat) && l.text.startsWith('你的情侣'));
    const isWolfAudience = !!(role.wolfTeam || me.flags.convertedWolf);
    meView = {
      seat: me.seat,
      role: me.role,
      roleName: role.name,
      initialRole: me.initialRole,
      // 只显示自己知道的阵营（混血儿不知道榜样阵营）
      side: me.flags.convertedWolf || role.faction === 'wolf' ? 'wolf' : 'good',
      alive: me.alive,
      wolfTeam: inWolfTeam ? ctx.wolfTeamSeats().filter((x) => x !== me.seat) : [],
      lover: knowsLover ? lovers!.find((x) => x !== me.seat) ?? null : null,
      thirdTeam: !!(knowsLover && s.roleState.cupid?.third) || (me.role === 'cupid' && !!s.roleState.cupid?.third),
      info: s.log
        .filter((l) => (Array.isArray(l.to) && l.to.includes(me.seat)) || (l.to === 'wolves' && isWolfAudience))
        .map((l) => ({ day: l.day, phase: l.phase, text: l.text })),
    };
    const prompt = s.prompts.find((p) => p.seats.includes(me.seat));
    if (prompt) {
      promptView = {
        id: prompt.id,
        spec: prompt.specs[me.seat],
        deadline: prompt.deadline,
        submitted: !!prompt.responses[me.seat],
        response: prompt.responses[me.seat],
        feedback: prompt.feedback[me.seat],
        closed: !!prompt.closed,
      };
      if (prompt.group) {
        const intents: Record<Seat, Payload> = {};
        for (const x of prompt.seats) if (x !== me.seat && prompt.responses[x]) intents[x] = prompt.responses[x];
        promptView.intents = intents;
      }
    }
  }

  const votes = s.rules.voteDetail === 'public' ? s.votes : s.votes.map((v) => ({ ...v, ballots: [] }));

  return {
    id: s.id,
    phase: s.phase,
    day: s.day,
    stage: s.stage,
    paused: !!s.paused,
    announce: s.announce?.text ?? null,
    board: s.board,
    rules: s.rules,
    players,
    sheriff: s.sheriff,
    election: { status: s.election.status, candidates: s.election.candidates, withdrawn: s.election.withdrawn },
    speech: s.speech ? { seat: s.speech.seat, label: s.speech.label } : null,
    me: meView,
    prompt: promptView,
    actions: me && !over
      ? { explode: canExplodeNow(ctx, me.seat), duel: canDuelNow(ctx, me.seat), withdraw: canWithdrawNow(ctx, me.seat) }
      : { explode: false, duel: false, withdraw: false },
    log: s.log.filter((l) => l.to === 'all').map((l) => ({ id: l.id, day: l.day, phase: l.phase, text: l.text })),
    votes,
    winner: s.winner,
    reveal: over
      ? s.players.map((p) => ({ seat: p.seat, role: p.role, initialRole: p.initialRole, alive: p.alive, deathCause: p.deathCause, team: ctx.team(p.seat) }))
      : null,
  };
}

/** 游戏结束时每名玩家是否获胜 */
export function playerResults(state: GameState): { seat: Seat; won: boolean; team: string }[] {
  const ctx = new Ctx(state, Date.now());
  const w = state.winner?.faction;
  return state.players.map((p) => {
    const team = ctx.team(p.seat);
    return { seat: p.seat, team, won: !!w && w !== 'aborted' && team === w };
  });
}
