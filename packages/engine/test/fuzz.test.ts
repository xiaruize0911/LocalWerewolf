import { describe, expect, it } from 'vitest';
import { PRESETS } from '../src/presets.ts';
import { createGame, dispatch, nextTimer } from '../src/engine.ts';
import { project } from '../src/view.ts';
import { seedRng, nextFloat } from '../src/rng.ts';
import type { GameState, Payload, PromptSpec } from '../src/types.ts';

function randomPayload(r: () => number, spec: PromptSpec): Payload {
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
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
      for (const f of spec.fields) {
        if (r() < 0.5) continue;
        values[f.key] = f.kind === 'toggle' ? true : pick(f.candidates ?? []);
      }
      return { values };
    }
    default: return {};
  }
}

/** 视图中不能出现其他玩家的身份 */
function assertNoLeak(state: GameState) {
  if (state.phase === 'over') return;
  for (const p of state.players) {
    const v = project(state, p.seat);
    for (const o of v.players) {
      const flipped = state.players.find((x) => x.seat === o.seat)!.flags.flipped;
      if (o.seat !== p.seat && !flipped) expect(o.revealed).toBeUndefined();
    }
    expect(v.reveal).toBeNull();
    // 结构化字段里只有自己的 role
    const json = JSON.stringify({ ...v, me: null });
    expect(json.includes('"role":')).toBe(false);
    expect(json.includes('"initialRole":')).toBe(false);
  }
  const disp = project(state, null);
  expect(disp.me).toBeNull();
  expect(disp.prompt).toBeNull();
}

function playRandom(presetBoard: Record<string, number>, rules: any, seed: string, opts: { leak?: boolean } = {}) {
  const rs = seedRng(seed);
  const r = () => nextFloat(rs);
  const n = Object.values(presetBoard).reduce((a, b) => a + b, 0) - (presetBoard.thief ? 2 : 0);
  let now = 0;
  let { state } = createGame({
    players: Array.from({ length: n }, (_, i) => ({ seat: i + 1, userId: i + 1, name: `P${i + 1}` })),
    board: presetBoard, rules, seed, now,
  });
  let steps = 0;
  while (state.phase !== 'over') {
    if (++steps > 20000) throw new Error(`卡死：${JSON.stringify(state.current)}`);
    // 死人不会收到夜间/投票提示
    for (const p of state.prompts) {
      if (['night', 'vote', 'electionVote', 'signup'].includes(p.purpose)) {
        for (const seat of p.seats) expect(state.players.find((x) => x.seat === seat)!.alive).toBe(true);
      }
    }
    let cmd: any = null;
    if (state.announce && r() < 0.9) cmd = { t: 'announceDone', id: state.announce.id };
    else {
      const open = state.prompts.filter((p) => !p.closed).flatMap((p) => p.seats.filter((s) => !p.responses[s]).map((s) => ({ p, s })));
      if (open.length && r() < 0.85) {
        const { p, s } = open[Math.floor(r() * open.length)];
        cmd = { t: 'submit', seat: s, promptId: p.id, payload: randomPayload(r, p.specs[s]) };
      } else if (state.current?.kind === 'speech' && r() < 0.7) {
        cmd = { t: 'speechEnd', seat: state.current.seat };
      } else if (state.current?.kind === 'freeTalk' && r() < 0.7) {
        cmd = { t: 'host', action: 'startVote' };
      } else if (state.phase === 'day' && r() < 0.02) {
        const alive = state.players.filter((p) => p.alive);
        const p = alive[Math.floor(r() * alive.length)];
        cmd = { t: 'dayAction', seat: p.seat, action: r() < 0.5 ? 'explode' : 'duel', target: alive[Math.floor(r() * alive.length)].seat };
      } else {
        const t = nextTimer(state);
        if (t == null && state.current?.kind === 'speech') cmd = { t: 'speechEnd', seat: state.current.seat };
        else if (t == null && state.current?.kind === 'freeTalk') cmd = { t: 'host', action: 'startVote' };
        else if (t == null) throw new Error(`没有计时器也没有可执行操作：${JSON.stringify(state.current)}`);
      }
      if (!cmd) {
        const t = nextTimer(state)!;
        now = Math.max(now, t);
        cmd = { t: 'tick' };
      }
    }
    const res = dispatch(state, cmd, now);
    state = res.state;
    if (opts.leak && steps % 7 === 0) assertNoLeak(state);
  }
  // 结束时恰好一个胜者
  expect(state.winner).toBeTruthy();
  expect(['good', 'wolf', 'third']).toContain(state.winner!.faction);
  // 状态可以 JSON 往返
  expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  return state;
}

describe('随机对局（模糊测试）', () => {
  for (const preset of PRESETS) {
    it(`板子 ${preset.name} 的随机对局都能正常结束`, () => {
      for (let i = 0; i < 25; i++) playRandom(preset.board, preset.rules, `${preset.id}-${i}`, { leak: i < 3 });
    });
  }

  it('包含所有角色的混合板子也能正常结束', () => {
    const boards: Record<string, number>[] = [
      { werewolf: 2, nightmare: 1, magician: 1, dreamer: 1, seer: 1, witch: 1, villager: 3, crow: 1, silencer: 1 },
      { werewolf: 2, wolfBeauty: 1, hiddenWolf: 1, cupid: 1, wildChild: 1, mixedBlood: 1, seer: 1, witch: 1, hunter: 1, bearTamer: 1, villager: 1 },
      { werewolf: 2, bloodMoon: 1, gargoyle: 1, graveKeeper: 1, demonHunter: 1, voteBanner: 1, knight: 1, villager: 2, thief: 1, seer: 1, idiot: 1 },
      { werewolf: 2, evilKnight: 1, machineWolf: 1, psychic: 1, witch: 1, guard: 1, hunter: 1, villager: 4 },
    ];
    for (const [bi, b] of boards.entries()) {
      for (let i = 0; i < 40; i++) playRandom(b, { sheriff: i % 2 === 0, speech: i % 3 ? 'on' : 'off' }, `mix${bi}-${i}`, { leak: i < 2 });
    }
  });

  it('同一种子可以复现', () => {
    const a = playRandom(PRESETS[0].board, {}, 'same');
    const b = playRandom(PRESETS[0].board, {}, 'same');
    expect(a.log).toEqual(b.log);
  });
});

describe('防时序泄露', () => {
  it('每个夜间步骤都有最短持续时间，不论角色是否存在', () => {
    const { state } = createGame({
      players: Array.from({ length: 6 }, (_, i) => ({ seat: i + 1, userId: i + 1, name: `P${i + 1}` })),
      board: { werewolf: 2, villager: 2, seer: 1, witch: 1 }, seed: 'x', now: 0, skipRoleCheck: true,
    });
    // 让预言家先「死」：直接看 nightAct 进入时都设置了 pad 计时器
    let s = state;
    let now = 0;
    const pads: number[] = [];
    for (let i = 0; i < 400 && s.day <= 1; i++) {
      if (s.current?.kind === 'nightAct' && s.timers.pad && !pads.includes(s.timers.pad)) pads.push(s.timers.pad - now);
      if (s.announce) { s = dispatch(s, { t: 'announceDone', id: s.announce.id }, now).state; continue; }
      const t = nextTimer(s);
      if (t == null) break;
      now = t;
      s = dispatch(s, { t: 'tick' }, now).state;
    }
    expect(pads.length).toBeGreaterThanOrEqual(3);
    for (const p of pads) expect(p).toBeGreaterThanOrEqual(8000);
  });
});
