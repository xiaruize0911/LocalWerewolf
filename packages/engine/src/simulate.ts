import { createGame, dispatch, nextTimer } from './engine.ts';
import { PRESETS } from './presets.ts';
import { nextFloat, seedRng } from './rng.ts';
import type { Board, Command, Effect, GameState, Payload, PromptSpec, Rules } from './types.ts';

function randomPayload(r: () => number, spec: PromptSpec): Payload {
  const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
  switch (spec.type) {
    case 'pickSeat':
      if (spec.allowSkip && r() < 0.3) return { seat: null };
      return { seat: pick(spec.candidates) };
    case 'pickTwo': {
      if (spec.allowSkip && r() < 0.3) return { seats: null };
      const a = pick(spec.candidates);
      const rest = spec.candidates.filter((x) => x !== a);
      return { seats: rest.length ? [a, pick(rest)] : null };
    }
    case 'choice': return { value: pick(spec.options).value };
    case 'form': {
      const values: Record<string, any> = {};
      for (const f of spec.fields) if (r() < 0.5) values[f.key] = f.kind === 'toggle' ? true : pick(f.candidates ?? []);
      return { values };
    }
    default: return {};
  }
}

/** 用随机操作把一局打完，返回过程中所有的播报文本 */
export function randomPlaythrough(board: Board, rules: Partial<Rules>, seed: string, onState?: (s: GameState) => void): { state: GameState; announcements: string[] } {
  const rs = seedRng(seed);
  const r = () => nextFloat(rs);
  const n = Object.values(board).reduce((a, b) => a + b, 0) - (board.thief ? 2 : 0);
  let now = 0;
  const texts: string[] = [];
  const collect = (effects: Effect[]) => {
    for (const e of effects) if (e.t === 'announce') texts.push(e.text);
  };
  const created = createGame({ players: Array.from({ length: n }, (_, i) => ({ seat: i + 1, userId: i + 1, name: `P${i + 1}` })), board, rules, seed, now });
  let state = created.state;
  collect(created.effects);
  for (let steps = 0; state.phase !== 'over'; steps++) {
    if (steps > 20000) throw new Error(`模拟卡死：${JSON.stringify(state.current)}`);
    let cmd: Command | null = null;
    const open = state.prompts.filter((p) => !p.closed).flatMap((p) => p.seats.filter((s) => !p.responses[s]).map((s) => ({ p, s })));
    if (state.announce && r() < 0.9) cmd = { t: 'announceDone', id: state.announce.id };
    else if (open.length && r() < 0.85) {
      const { p, s } = open[Math.floor(r() * open.length)];
      cmd = { t: 'submit', seat: s, promptId: p.id, payload: randomPayload(r, p.specs[s]) };
    } else if (state.current?.kind === 'speech' && r() < 0.7) cmd = { t: 'speechEnd', seat: state.current.seat };
    else if (state.current?.kind === 'freeTalk' && r() < 0.7) cmd = { t: 'host', action: 'startVote' };
    else if (state.phase === 'day' && r() < 0.02) {
      const alive = state.players.filter((p) => p.alive);
      cmd = { t: 'dayAction', seat: alive[Math.floor(r() * alive.length)].seat, action: r() < 0.5 ? 'explode' : 'duel', target: alive[Math.floor(r() * alive.length)].seat };
    }
    if (!cmd) {
      const t = nextTimer(state);
      if (t == null && state.current?.kind === 'speech') cmd = { t: 'speechEnd', seat: state.current.seat };
      else if (t == null && state.current?.kind === 'freeTalk') cmd = { t: 'host', action: 'startVote' };
      else if (t == null) throw new Error(`没有可执行操作：${JSON.stringify(state.current)}`);
      else {
        now = Math.max(now, t);
        cmd = { t: 'tick' };
      }
    }
    const res = dispatch(state, cmd, now);
    state = res.state;
    collect(res.effects);
    onState?.(state);
  }
  return { state, announcements: texts };
}

/** 覆盖所有角色的混合板子，用于模拟与预生成语音 */
export const MIXED_BOARDS: Board[] = [
  { werewolf: 2, nightmare: 1, magician: 1, dreamer: 1, seer: 1, witch: 1, villager: 3, crow: 1, silencer: 1 },
  { werewolf: 2, wolfBeauty: 1, hiddenWolf: 1, cupid: 1, wildChild: 1, mixedBlood: 1, seer: 1, witch: 1, hunter: 1, bearTamer: 1, villager: 1 },
  { werewolf: 2, bloodMoon: 1, gargoyle: 1, graveKeeper: 1, demonHunter: 1, voteBanner: 1, knight: 1, villager: 2, thief: 1, seer: 1, idiot: 1 },
  { werewolf: 2, evilKnight: 1, machineWolf: 1, psychic: 1, witch: 1, guard: 1, hunter: 1, villager: 4 },
];

/** 收集所有可能出现的播报文本（去重） */
export function collectAnnouncements(gamesPerBoard = 4): string[] {
  const set = new Set<string>([
    '语音已开启', '熊没有咆哮', '游戏结束，情侣阵营获胜', '游戏结束，房主终止了游戏', '警长竞选顺延到明天', '警徽流失，本局没有警长',
    '1号骑士翻牌，与2号决斗', '2号是狼人，决斗成功', '2号是好人，骑士以死谢罪', '1号退水', '其他候选人已退水，1号当选警长',
    '所有候选人都已退水，警徽流失', '没有可以投票的玩家，警徽流失', '全部弃票，警徽流失', '再次平票，警徽流失', '血月使徒的封印生效',
    '白狼王1号带走了2号', '1号，发言时间到',
    ...Array.from({ length: 20 }, (_, i) => `${i + 1}号`),
  ]);
  const boards: { board: Board; rules: Partial<Rules> }[] = [...PRESETS.map((p) => ({ board: p.board, rules: p.rules ?? {} })), ...MIXED_BOARDS.map((b) => ({ board: b, rules: {} }))];
  for (const [bi, b] of boards.entries()) {
    for (let i = 0; i < gamesPerBoard; i++) {
      const rules = { ...b.rules, sheriff: i % 2 === 0 ? b.rules.sheriff ?? true : false, speech: i % 3 === 2 ? 'off' : 'on', speechReminder: i === 1 ? 30 : 0 };
      for (const t of randomPlaythrough(b.board, rules, `voice-${bi}-${i}`).announcements) set.add(t);
    }
  }
  return [...set];
}

/** 把播报中的座位号抽象成模板：{S} 单个座位，{L} 多个座位（顿号分隔） */
export function toTemplate(text: string): string {
  return text.replace(/\d+号(?:、\d+号)+/g, '{L}').replace(/\d+号/g, '{S}');
}

export interface VoiceCatalog {
  /** 需要整句预生成的所有句子 */
  sentences: string[];
  /** 三人及以上名单的句子模板，播报时由片段拼接 */
  listTemplates: string[];
}

/**
 * 语音目录：模拟对局收集所有播报模板，再把座位号展开成具体句子。
 *  - 无座位号：直接收录
 *  - 一个或两个座位号：展开 1..maxSeats 的所有组合
 *  - 名单 {L}：展开所有两人组合；三人及以上在播报时拼接
 */
export function voiceCatalog(maxSeats = 20, gamesPerBoard = 8): VoiceCatalog {
  const templates = new Set(collectAnnouncements(gamesPerBoard).map(toTemplate));
  const seats = Array.from({ length: maxSeats }, (_, i) => i + 1);
  const out = new Set<string>();
  const listTemplates: string[] = [];
  for (const t of templates) {
    const parts = t.split(/(\{S\}|\{L\})/);
    const holes = parts.filter((p) => p === '{S}' || p === '{L}');
    if (holes.includes('{L}')) listTemplates.push(t);
    // 每个空位的候选值
    const options = holes.map((h) => (h === '{S}' ? seats.map((s) => `${s}号`) : pairs(seats).map(([a, b]) => `${a}号、${b}号`)));
    // 两个 {S} 且模板语义是同一人时（只有X号上警，X号当选警长）只展开相同座位
    const sameSeat = holes.length === 2 && holes.every((h) => h === '{S}') && /只有\{S\}上警/.test(t);
    const fill = (i: number, acc: string[]) => {
      if (i === holes.length) {
        let k = 0;
        out.add(parts.map((p) => (p === '{S}' || p === '{L}' ? acc[k++] : p)).join(''));
        return;
      }
      for (const v of options[i]) {
        if (sameSeat && i === 1 && v !== acc[0]) continue;
        if (!sameSeat && i > 0 && holes[i] === '{S}' && holes[i - 1] === '{S}' && v === acc[i - 1]) continue;
        fill(i + 1, [...acc, v]);
      }
    };
    fill(0, []);
  }
  return { sentences: [...out], listTemplates };
}

function pairs(seats: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < seats.length; i++) for (let j = i + 1; j < seats.length; j++) out.push([seats[i], seats[j]]);
  return out;
}
