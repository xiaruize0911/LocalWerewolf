export type Seat = number;
export type RoleId = string;
export type Faction = 'good' | 'wolf' | 'third';
export type Category = 'god' | 'villager' | 'wolf' | 'third';
export type Phase = 'night' | 'day' | 'over';

/** 配板：角色 -> 数量（有盗贼时总数 = 人数 + 2） */
export type Board = Record<RoleId, number>;

export interface PlayerInit {
  seat: Seat;
  userId: number | string;
  name: string;
  isBot?: boolean;
}

export interface Player extends PlayerInit {
  role: RoleId;
  initialRole: RoleId;
  alive: boolean;
  deathDay?: number;
  deathCause?: DeathCause;
  /** 角色相关的个人状态（白痴已翻牌、机械狼学到的身份等） */
  flags: Record<string, any>;
}

export type DeathCause =
  | 'wolf' | 'sameGuardSave' | 'poison' | 'shot' | 'exile' | 'explode' | 'taken'
  | 'lover' | 'charm' | 'dream' | 'reflect' | 'hunt' | 'huntFail' | 'duel' | 'duelFail'
  | 'bloodMoon';

export const DEATH_CAUSE_TEXT: Record<DeathCause, string> = {
  wolf: '被狼人杀害',
  sameGuardSave: '同守同救',
  poison: '被毒杀',
  shot: '被枪杀',
  exile: '被放逐',
  explode: '自爆',
  taken: '被白狼王带走',
  lover: '殉情',
  charm: '随狼美人殉情',
  dream: '梦游死亡',
  reflect: '被恶灵骑士反伤',
  hunt: '被猎魔人狩猎',
  huntFail: '狩猎失败',
  duel: '决斗出局',
  duelFail: '决斗失败',
  bloodMoon: '血月使徒天亮出局',
};

export type Audience = 'all' | 'wolves' | Seat[];

export interface LogEntry {
  id: number;
  day: number;
  phase: Phase;
  text: string;
  to: Audience;
}

export interface PromptOption {
  value: string;
  label: string;
}

export interface FormField {
  key: string;
  label: string;
  kind: 'seat' | 'toggle';
  candidates?: Seat[];
  optional?: boolean;
}

export type PromptSpec =
  | { type: 'pickSeat'; title: string; desc?: string; candidates: Seat[]; allowSkip?: boolean; skipLabel?: string }
  | { type: 'pickTwo'; title: string; desc?: string; candidates: Seat[]; allowSkip?: boolean; skipLabel?: string }
  | { type: 'choice'; title: string; desc?: string; options: PromptOption[] }
  | { type: 'confirm'; title: string; desc?: string; okLabel?: string }
  | { type: 'form'; title: string; desc?: string; fields: FormField[]; okLabel?: string };

/**
 * 提交的数据：
 *  pickSeat -> { seat: number | null }
 *  pickTwo  -> { seats: [a, b] | null }
 *  choice   -> { value: string }
 *  confirm  -> {}
 *  form     -> { values: Record<string, any> }
 */
export type Payload = Record<string, any>;

export interface Prompt {
  id: string;
  /** 用途，用于步骤内部路由 */
  purpose: string;
  seats: Seat[];
  /** 每个座位可以拿到不同的提示（例如女巫看到刀口） */
  specs: Record<Seat, PromptSpec>;
  responses: Record<Seat, Payload>;
  /** 提交后的私密反馈（预言家查验结果等） */
  feedback: Record<Seat, string>;
  /** 是否是群体决策（狼人），同组成员互相可见意向 */
  group?: boolean;
  deadline?: number;
  /** 已结束（不再接受提交） */
  closed?: boolean;
}

export interface Step {
  kind: string;
  [k: string]: any;
}

export interface NightCtx {
  night: number;
  fear: Seat | null;
  swap: [Seat, Seat] | null;
  dream: Seat | null;
  guard: Seat | null;
  wolfKill: Seat | null;
  wolfKill2: Seat | null;
  save: boolean;
  poison: Seat | null;
  poisonBy: Seat | null;
  machineGuard: Seat | null;
  machinePoison: Seat | null;
  hunt: Seat | null;
  hunter: Seat | null;
  charm: Seat | null;
  curse: Seat | null;
  silence: Seat | null;
  voteBan: Seat | null;
  checks: { by: Seat; target: Seat }[];
  sealGood: boolean;
}

export interface Announcement {
  id: string;
  text: string;
}

export interface VoteRecord {
  title: string;
  ballots: { voter: Seat; target: Seat | null; weight: number }[];
  tally: { seat: Seat; score: number }[];
  result: string;
}

export interface GameState {
  id: string;
  board: Board;
  rules: Rules;
  roleConfig: Record<RoleId, Record<string, any>>;
  players: Player[];
  /** 盗贼的两张底牌 */
  extraCards: RoleId[];
  phase: Phase;
  day: number;
  stage: string;
  agenda: Step[];
  current: Step | null;
  prompts: Prompt[];
  timers: Record<string, number>;
  announce: Announcement | null;
  night: NightCtx;
  prevNight: NightCtx | null;
  roleState: Record<string, any>;
  /** 天亮后待公布的死亡 */
  pendingDeaths: { seat: Seat; cause: DeathCause }[];
  sheriff: Seat | null;
  election: {
    status: 'notYet' | 'running' | 'done' | 'lost' | 'postponed';
    candidates: Seat[];
    withdrawn: Seat[];
    explodes: number;
  };
  speech: { seat: Seat | null; label: string; group: string } | null;
  lastWordsLeft: number;
  lastExiled: { seat: Seat; day: number } | null;
  votes: VoteRecord[];
  log: LogEntry[];
  seq: number;
  paused: number | null;
  winner: { faction: Faction | 'aborted'; text: string } | null;
  rng: [number, number, number, number];
}

export type Command =
  | { t: 'tick' }
  | { t: 'announceDone'; id: string }
  | { t: 'submit'; seat: Seat; promptId: string; payload: Payload }
  | { t: 'speechEnd'; seat: Seat }
  | { t: 'dayAction'; seat: Seat; action: 'explode' | 'duel' | 'withdraw'; target?: Seat }
  | { t: 'host'; action: 'pause' | 'resume' | 'nextSpeaker' | 'skipAllSpeech' | 'startVote' | 'advance' | 'abort' };

export type Effect =
  | { t: 'announce'; id: string; text: string }
  | { t: 'over' }
  | { t: 'error'; seat?: Seat; message: string };

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Rules extends Record<string, any> {}
