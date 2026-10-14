import { RuleError, seatList, type Ctx } from '../ctx.ts';
import { killPlayers } from '../deaths.ts';
import { getRole } from '../roles/registry.ts';
import { defineStep, endCurrent, type StepEvent } from '../steps.ts';
import { DEATH_CAUSE_TEXT, type Prompt, type Seat, type Step, type VoteRecord } from '../types.ts';
import { evaluateWin } from '../win.ts';

// ---------------------------------------------------------------- 工具

const isHost = (ev: StepEvent, ...actions: string[]) => ev.t === 'host' && actions.includes(ev.action);

/** 只有一个提示的步骤：全部提交、超时或房主推进时完成 */
function promptDone(ctx: Ctx, step: Step, ev: StepEvent, onClose: (p: Prompt, timedOut: boolean) => void): boolean {
  const prompt = ctx.s.prompts.find((p) => p.id === step.promptId);
  if (!prompt) return true;
  if (ev.t === 'submit') {
    if (prompt.seats.every((s) => prompt.responses[s])) {
      ctx.closePrompt(prompt);
      onClose(prompt, false);
      return true;
    }
    return false;
  }
  if (ev.t === 'deadline' || isHost(ev, 'advance')) {
    ctx.closePrompt(prompt);
    onClose(prompt, true);
    return true;
  }
  return false;
}

function seatOf(payload: any): Seat | null {
  return payload?.seat == null ? null : Number(payload.seat);
}

/** 从 start 开始按方向绕一圈 */
function circle(all: Seat[], start: Seat, dir: 1 | -1): Seat[] {
  const seats = [...all].sort((a, b) => a - b);
  const i = seats.indexOf(start);
  return seats.map((_, k) => seats[(((i + dir * k) % seats.length) + seats.length) % seats.length]);
}

function canVote(ctx: Ctx, seat: Seat): boolean {
  if (!ctx.alive(seat)) return false;
  if (ctx.s.night.voteBan === seat) return false;
  const role = ctx.roleOf(seat);
  return role.canVote ? role.canVote(ctx, seat) : true;
}

/** 一轮发言：开启发言时逐个点名，关闭时为自由讨论 */
function speechRound(ctx: Ctx, order: Seat[], label: string, opts: { election?: boolean; intro?: string } = {}): Step[] {
  const group = ctx.id('g');
  if (ctx.rules.speech === 'off' || !order.length) {
    return [{ kind: 'freeTalk', label, group, election: opts.election }];
  }
  const steps: Step[] = [];
  const silenced = ctx.s.night.silence;
  const list = order.filter((s) => s !== silenced || opts.election);
  if (!list.length) return [];
  steps.push({ kind: 'announce', text: opts.intro ?? `${label}，从${list[0]}号开始发言`, group, election: opts.election });
  for (const seat of list) steps.push({ kind: 'speech', seat, label, group, election: opts.election });
  return steps;
}

// ---------------------------------------------------------------- 开局

defineStep('roleCheck', {
  enter(ctx, step) {
    ctx.stage('查看身份');
    const p = ctx.openPrompt({
      purpose: 'roleCheck',
      seats: ctx.allSeats(),
      spec: { type: 'confirm', title: '请查看你的身份', desc: '确认后等待所有人准备好。', okLabel: '我已查看身份' },
      timeoutSec: 180,
    });
    step.promptId = p.id;
    return false;
  },
  on(ctx, step, ev) {
    return promptDone(ctx, step, ev, () => {});
  },
});

// ---------------------------------------------------------------- 白天开始

defineStep('dayStart', {
  enter(ctx) {
    const s = ctx.s;
    s.phase = 'day';
    ctx.stage(`第${s.day}天`);
    ctx.log(`—— 第${s.day}天 ——`);
    const steps: Step[] = [ctx.announce('天亮了')];
    const el = s.election.status;
    if (s.rules.sheriff && ((s.day === 1 && el === 'notYet') || el === 'postponed')) steps.push({ kind: 'election', election: true });
    steps.push({ kind: 'announceDeaths' }, { kind: 'discussion' }, { kind: 'exileVote', round: 1 }, { kind: 'checkWin' }, { kind: 'nightStart' });
    ctx.pushFront(...steps);
    return true;
  },
});

defineStep('announceDeaths', {
  enter(ctx) {
    const s = ctx.s;
    const deaths = [...s.pendingDeaths].sort((a, b) => a.seat - b.seat).filter((d) => ctx.alive(d.seat));
    s.pendingDeaths = [];
    s.roleState._lastNightDeaths = deaths.map((d) => d.seat);
    let text: string;
    if (!deaths.length) text = '昨晚是平安夜';
    else if (s.rules.deathCause === 'public') text = `昨晚${deaths.map((d) => `${d.seat}号（${DEATH_CAUSE_TEXT[d.cause]}）`).join('、')}死亡`;
    else text = `昨晚${seatList(deaths.map((d) => d.seat))}玩家死亡`;
    ctx.log(text);
    const front: Step[] = [ctx.announce(text)];
    const after = killPlayers(ctx, deaths, 'night');
    if (s.night.silence != null && ctx.alive(s.night.silence)) {
      const t = `${s.night.silence}号玩家被禁言，今天不能发言`;
      ctx.log(t);
      front.push(ctx.announce(t));
    }
    if (s.night.voteBan != null && ctx.alive(s.night.voteBan)) {
      const t = `${s.night.voteBan}号玩家今天不能投票`;
      ctx.log(t);
      front.push(ctx.announce(t));
    }
    for (const id of new Set(s.players.map((p) => p.role))) {
      const r = getRole(id);
      if (r?.dayStart) front.push(...r.dayStart(ctx));
    }
    ctx.pushFront(...front, ...after, { kind: 'checkWin' });
    return true;
  },
});

// ---------------------------------------------------------------- 死亡后续

/** 每名死者都会被询问（避免从「谁被询问」看出猎人），只有能开枪的才有目标可选 */
defineStep('deathSkill', {
  enter(ctx, step) {
    if (ctx.s.phase === 'over') return true;
    ctx.stage(`${step.seat}号玩家发动技能`);
    const seat: Seat = step.seat;
    const spec = step.can
      ? { type: 'pickSeat' as const, title: '你出局了，是否发动技能开枪带走一名玩家？', candidates: ctx.aliveSeats(), allowSkip: true, skipLabel: '不开枪' }
      : { type: 'confirm' as const, title: '你出局了', desc: '你没有可以发动的技能。', okLabel: '知道了' };
    const p = ctx.openPrompt({ purpose: 'deathSkill', seats: [seat], spec, timeoutSec: ctx.rules.skillTimeout });
    step.promptId = p.id;
    ctx.effects.push({ t: 'announce', id: ctx.id('a'), text: `请${seat}号玩家确认是否发动技能` });
    return false;
  },
  on(ctx, step, ev) {
    if (ev.t === 'submit' && step.can) {
      const t = seatOf(ev.payload);
      if (t != null && !ctx.alive(t)) throw new RuleError('该玩家已出局');
    }
    return promptDone(ctx, step, ev, (p) => {
      const t = step.can ? seatOf(p.responses[step.seat]) : null;
      if (t == null) return;
      const text = `${step.seat}号玩家发动技能，带走了${t}号`;
      ctx.log(text);
      const after = killPlayers(ctx, [{ seat: t, cause: 'shot' }], 'day');
      ctx.pushFront(ctx.announce(text), ...after, { kind: 'checkWin' });
    });
  },
});

defineStep('badge', {
  enter(ctx, step) {
    if (ctx.s.sheriff !== step.seat || ctx.s.phase === 'over') return true;
    ctx.stage('移交警徽');
    const destroy = !!ctx.rules.badgeDestroy;
    const p = ctx.openPrompt({
      purpose: 'badge', seats: [step.seat], timeoutSec: ctx.rules.skillTimeout,
      spec: { type: 'pickSeat', title: '请移交警徽', candidates: ctx.aliveSeats(), allowSkip: destroy, skipLabel: '撕毁警徽' },
    });
    step.promptId = p.id;
    ctx.effects.push({ t: 'announce', id: ctx.id('a'), text: `请警长${step.seat}号移交警徽` });
    return false;
  },
  on(ctx, step, ev) {
    if (ev.t === 'submit') {
      const t = seatOf(ev.payload);
      if (t != null && !ctx.alive(t)) throw new RuleError('该玩家已出局');
      if (t == null && !ctx.rules.badgeDestroy) throw new RuleError('必须移交警徽');
    }
    return promptDone(ctx, step, ev, (p, timedOut) => {
      let t = seatOf(p.responses[step.seat]);
      if (timedOut && t == null && !ctx.rules.badgeDestroy) t = ctx.pick(ctx.aliveSeats());
      ctx.s.sheriff = t;
      const text = t == null ? '警长撕毁了警徽，本局不再有警长' : `警徽移交给${t}号`;
      ctx.log(text);
      ctx.pushFront(ctx.announce(text));
    });
  },
});

// ---------------------------------------------------------------- 发言

defineStep('speech', {
  enter(ctx, step) {
    if (!step.lastWords && !ctx.alive(step.seat)) return true;
    ctx.s.speech = { seat: step.seat, label: step.label, group: step.group };
    ctx.stage(`${step.seat}号${step.label}`);
    if (step.lastWords) ctx.effects.push({ t: 'announce', id: ctx.id('a'), text: `请${step.seat}号玩家发表遗言` });
    if (ctx.rules.speechReminder > 0) ctx.timer('remind', ctx.rules.speechReminder * 1000);
    return false;
  },
  on(ctx, step, ev) {
    if (ev.t === 'timer' && ev.id === 'remind') {
      ctx.effects.push({ t: 'announce', id: ctx.id('a'), text: `${step.seat}号，发言时间到` });
      return false;
    }
    if (ev.t === 'speechEnd') return ev.seat === step.seat;
    return isHost(ev, 'nextSpeaker', 'advance', 'startVote');
  },
});

defineStep('freeTalk', {
  enter(ctx, step) {
    ctx.s.speech = { seat: null, label: step.label, group: step.group };
    ctx.stage(step.label);
    const text = step.label === '自由讨论' ? '现在开始自由讨论，讨论结束后由房主开始投票' : `${step.label}，请自由讨论，讨论结束后由房主开始下一环节`;
    ctx.effects.push({ t: 'announce', id: ctx.id('a'), text });
    return false;
  },
  on(_ctx, _step, ev) {
    return isHost(ev, 'nextSpeaker', 'advance', 'startVote');
  },
});

defineStep('discussion', {
  enter(ctx) {
    const s = ctx.s;
    const alive = ctx.aliveSeats();
    if (!alive.length) return true;
    if (s.rules.speech === 'off') {
      ctx.pushFront(...speechRound(ctx, [], '自由讨论'));
      return true;
    }
    const sheriff = s.sheriff != null && ctx.alive(s.sheriff) ? s.sheriff : null;
    if (sheriff != null && s.rules.sheriffSpeechOrder === 'sheriffChooses') {
      ctx.pushFront({ kind: 'sheriffOrder', seat: sheriff });
      return true;
    }
    let order: Seat[];
    if (sheriff != null) {
      order = circle(alive, sheriff, 1).slice(1).concat(sheriff);
    } else if (s.rules.speechOrder === 'fromOne') {
      order = [...alive].sort((a, b) => a - b);
    } else if (s.rules.speechOrder === 'afterDeath' && s.roleState._lastNightDeaths?.length) {
      const dead: Seat = Math.min(...s.roleState._lastNightDeaths);
      const all = ctx.allSeats();
      order = circle(all, dead, 1).slice(1).filter((x) => ctx.alive(x));
    } else {
      order = circle(alive, ctx.pick(alive), ctx.rand() < 0.5 ? 1 : -1);
    }
    ctx.pushFront(...speechRound(ctx, order, '白天发言'));
    return true;
  },
});

defineStep('sheriffOrder', {
  enter(ctx, step) {
    const seat: Seat = step.seat;
    const alive = ctx.aliveSeats();
    const asc = circle(alive, seat, 1);
    const desc = circle(alive, seat, -1);
    const p = ctx.openPrompt({
      purpose: 'sheriffOrder', seats: [seat], timeoutSec: ctx.rules.skillTimeout,
      spec: {
        type: 'choice', title: '警长请选择发言顺序', desc: '警长最后发言归票。',
        options: [
          { value: 'asc', label: `顺序：从${asc[1] ?? seat}号开始` },
          { value: 'desc', label: `逆序：从${desc[1] ?? seat}号开始` },
        ],
      },
    });
    step.promptId = p.id;
    ctx.stage('警长选择发言顺序');
    return false;
  },
  on(ctx, step, ev) {
    return promptDone(ctx, step, ev, (p) => {
      const dir = p.responses[step.seat]?.value === 'desc' ? -1 : 1;
      const order = circle(ctx.aliveSeats(), step.seat, dir).slice(1).concat(step.seat);
      ctx.pushFront(...speechRound(ctx, order, '白天发言'));
    });
  },
});

// ---------------------------------------------------------------- 投票

function tally(ctx: Ctx, prompt: Prompt, candidates: Seat[], weightOf: (s: Seat) => number, curse: Seat | null) {
  const ballots = prompt.seats.map((voter) => {
    const t = seatOf(prompt.responses[voter]);
    return { voter, target: t != null && candidates.includes(t) ? t : null, weight: weightOf(voter) };
  });
  const score = new Map<Seat, number>();
  for (const b of ballots) if (b.target != null) score.set(b.target, (score.get(b.target) ?? 0) + b.weight);
  if (curse != null && candidates.includes(curse) && ctx.alive(curse)) score.set(curse, (score.get(curse) ?? 0) + 1);
  const list = [...score].map(([seat, sc]) => ({ seat, score: sc })).sort((a, b) => b.score - a.score || a.seat - b.seat);
  const max = list[0]?.score ?? 0;
  const tops = max > 0 ? list.filter((x) => x.score === max).map((x) => x.seat) : [];
  return { ballots, list, tops };
}

function publishVote(ctx: Ctx, title: string, ballots: VoteRecord['ballots'], list: VoteRecord['tally'], result: string, curse?: Seat | null) {
  const rec: VoteRecord = { title, ballots, tally: list, result };
  ctx.s.votes.push(rec);
  const detail = ctx.rules.voteDetail === 'public'
    ? ballots.map((b) => `${b.voter}号→${b.target == null ? '弃票' : `${b.target}号`}${b.weight !== 1 ? `(${b.weight}票)` : ''}`).join('，')
    : '';
  const sum = list.map((x) => `${x.seat}号 ${x.score}票`).join('，') || '全部弃票';
  ctx.log(`${title}：${sum}${curse != null ? `（含乌鸦诅咒${curse}号 +1）` : ''}${detail ? `。明细：${detail}` : ''}。${result}`);
}

defineStep('exileVote', {
  enter(ctx, step) {
    const s = ctx.s;
    const candidates: Seat[] = step.candidates ?? ctx.aliveSeats();
    const voters = ctx.aliveSeats().filter((x) => canVote(ctx, x) && !(step.candidates ?? []).includes(x));
    step.candidates = candidates;
    ctx.stage(step.round > 1 ? 'PK 投票' : '放逐投票');
    if (!voters.length) {
      ctx.pushFront(ctx.announce('没有可以投票的玩家，今天无人被放逐'));
      return true;
    }
    const p = ctx.openPrompt({
      purpose: 'vote', seats: voters, timeoutSec: s.rules.voteTimeout,
      spec: { type: 'pickSeat', title: step.round > 1 ? 'PK 投票：请选择要放逐的玩家' : '请投票放逐一名玩家', candidates, allowSkip: true, skipLabel: '弃票' },
    });
    step.promptId = p.id;
    ctx.effects.push({ t: 'announce', id: ctx.id('a'), text: step.round > 1 ? `请为${seatList(candidates)}进行PK投票` : '发言结束，请开始投票' });
    return false;
  },
  on(ctx, step, ev) {
    return promptDone(ctx, step, ev, (p) => {
      const s = ctx.s;
      const weightOf = (v: Seat) => (s.sheriff === v ? Number(s.rules.sheriffVote) : 1);
      const curse = s.night.curse;
      const { ballots, list, tops } = tally(ctx, p, step.candidates, weightOf, curse);
      const pkRounds = s.rules.tieRule === 'pk2' ? 2 : s.rules.tieRule === 'pk1' ? 1 : 0;
      let result: string;
      if (!tops.length) {
        result = '所有人弃票，今天无人被放逐';
        ctx.pushFront(ctx.announce(result));
      } else if (tops.length === 1) {
        result = `${tops[0]}号被放逐`;
        ctx.pushFront(ctx.announce(result), { kind: 'exile', seat: tops[0] });
      } else if (step.round <= pkRounds) {
        result = `${seatList(tops)}平票，进入PK`;
        ctx.pushFront(ctx.announce(result), ...speechRound(ctx, tops, 'PK发言'), { kind: 'exileVote', round: step.round + 1, candidates: tops });
      } else {
        result = `${seatList(tops)}平票，今天是平安日`;
        ctx.pushFront(ctx.announce(result));
      }
      publishVote(ctx, step.round > 1 ? `第${s.day}天 PK 投票` : `第${s.day}天放逐投票`, ballots, list, result, curse != null && step.candidates.includes(curse) ? curse : null);
    });
  },
});

defineStep('exile', {
  enter(ctx, step) {
    const seat: Seat = step.seat;
    if (!ctx.alive(seat)) return true;
    const role = ctx.roleOf(seat);
    if (role.onExiled?.(ctx, seat)) return true;
    ctx.s.lastExiled = { seat, day: ctx.s.day };
    const after = killPlayers(ctx, [{ seat, cause: 'exile' }], 'day');
    ctx.pushFront(...after, { kind: 'checkWin' });
    return true;
  },
});

defineStep('checkWin', {
  enter(ctx) {
    const w = evaluateWin(ctx);
    if (!w) return true;
    endGame(ctx, w.faction, w.text);
    return true;
  },
});

export function endGame(ctx: Ctx, faction: any, text: string) {
  const s = ctx.s;
  s.winner = { faction, text };
  s.phase = 'over';
  s.agenda = [];
  ctx.stage('游戏结束');
  ctx.log(`游戏结束：${text}`);
  ctx.effects.push({ t: 'announce', id: ctx.id('a'), text: `游戏结束，${text}` }, { t: 'over' });
}

// ---------------------------------------------------------------- 警长竞选

defineStep('election', {
  enter(ctx) {
    const el = ctx.s.election;
    el.status = 'running';
    el.candidates = [];
    el.withdrawn = [];
    ctx.stage('警长竞选');
    ctx.pushFront(ctx.announce('现在开始警长竞选，想要上警的玩家请在手机上选择上警'), { kind: 'electionSignup', election: true });
    return true;
  },
});

defineStep('electionSignup', {
  enter(ctx, step) {
    const p = ctx.openPrompt({
      purpose: 'signup', seats: ctx.aliveSeats(), timeoutSec: ctx.rules.skillTimeout,
      spec: { type: 'choice', title: '是否上警竞选警长？', options: [{ value: 'run', label: '上警' }, { value: 'no', label: '不上警' }] },
    });
    step.promptId = p.id;
    return false;
  },
  on(ctx, step, ev) {
    return promptDone(ctx, step, ev, (p) => {
      const el = ctx.s.election;
      el.candidates = p.seats.filter((x) => p.responses[x]?.value === 'run');
      if (!el.candidates.length) {
        el.status = 'lost';
        ctx.log('无人上警，本局没有警长');
        ctx.pushFront(ctx.announce('无人上警，本局没有警长'));
        return;
      }
      if (el.candidates.length === 1) {
        electSheriff(ctx, el.candidates[0], `只有${el.candidates[0]}号上警`);
        return;
      }
      const text = `上警的玩家有：${seatList(el.candidates)}`;
      ctx.log(text);
      const order = circle(el.candidates, ctx.pick(el.candidates), ctx.rand() < 0.5 ? 1 : -1);
      ctx.pushFront(ctx.announce(text), ...speechRound(ctx, order, '警上发言', { election: true }), { kind: 'electionVote', round: 1, election: true });
    });
  },
});

function electSheriff(ctx: Ctx, seat: Seat, why: string) {
  const el = ctx.s.election;
  el.status = 'done';
  ctx.s.sheriff = seat;
  const text = `${why}，${seat}号当选警长`;
  ctx.log(text);
  ctx.pushFront(ctx.announce(text));
}

function loseBadge(ctx: Ctx, why: string) {
  ctx.s.election.status = 'lost';
  ctx.log(`${why}，警徽流失`);
  ctx.pushFront(ctx.announce(`${why}，警徽流失`));
}

defineStep('electionVote', {
  enter(ctx, step) {
    const el = ctx.s.election;
    const cands: Seat[] = (step.candidates ?? el.candidates).filter((x: Seat) => !el.withdrawn.includes(x) && ctx.alive(x));
    step.candidates = cands;
    if (!cands.length) {
      loseBadge(ctx, '所有候选人都已退水');
      return true;
    }
    if (cands.length === 1) {
      electSheriff(ctx, cands[0], '其他候选人已退水');
      return true;
    }
    const ran = el.candidates;
    const voters = ctx.aliveSeats().filter((x) => {
      if (step.round > 1) return !cands.includes(x);
      if (!ran.includes(x)) return true;
      return el.withdrawn.includes(x) && ctx.rules.withdrawnVote;
    });
    if (!voters.length) {
      loseBadge(ctx, '没有可以投票的玩家');
      return true;
    }
    ctx.stage(step.round > 1 ? '警长 PK 投票' : '警长投票');
    const p = ctx.openPrompt({
      purpose: 'electionVote', seats: voters, timeoutSec: ctx.rules.voteTimeout,
      spec: { type: 'pickSeat', title: '请投票选出警长', candidates: cands, allowSkip: true, skipLabel: '弃票' },
    });
    step.promptId = p.id;
    ctx.effects.push({ t: 'announce', id: ctx.id('a'), text: '请警下玩家投票选出警长' });
    return false;
  },
  on(ctx, step, ev) {
    return promptDone(ctx, step, ev, (p) => {
      const { ballots, list, tops } = tally(ctx, p, step.candidates, () => 1, null);
      const pk = tops.length > 1 && step.round === 1 && ctx.rules.electionTie === 'pk';
      const result = !tops.length ? '全部弃票，警徽流失'
        : tops.length === 1 ? `${tops[0]}号当选警长`
        : pk ? `${seatList(tops)}平票，进入PK` : '平票，警徽流失';
      publishVote(ctx, step.round > 1 ? '警长 PK 投票' : '警长投票', ballots, list, result);
      if (!tops.length) loseBadge(ctx, '全部弃票');
      else if (tops.length === 1) electSheriff(ctx, tops[0], '投票结束');
      else if (pk) ctx.pushFront(ctx.announce(result), ...speechRound(ctx, tops, '警长PK发言', { election: true }), { kind: 'electionVote', round: 2, candidates: tops, election: true });
      else loseBadge(ctx, '再次平票');
    });
  },
});

// ---------------------------------------------------------------- 自爆 / 白狼王 / 决斗

defineStep('explodeDie', {
  enter(ctx, step) {
    const seat: Seat = step.seat;
    const role = ctx.roleOf(seat);
    const extra = role.onExplode?.(ctx, seat) ?? [];
    const after = killPlayers(ctx, [{ seat, cause: 'explode' }], 'day');
    ctx.pushFront(...extra, ...after);
    return true;
  },
});

defineStep('whiteWolfTake', {
  enter(ctx, step) {
    const cands = ctx.aliveSeats();
    if (!cands.length) return true;
    ctx.stage('白狼王带人');
    const p = ctx.openPrompt({
      purpose: 'take', seats: [step.seat], timeoutSec: ctx.rules.skillTimeout,
      spec: { type: 'pickSeat', title: '白狼王：请选择要带走的玩家', candidates: cands, allowSkip: true, skipLabel: '不带人' },
    });
    step.promptId = p.id;
    return false;
  },
  on(ctx, step, ev) {
    return promptDone(ctx, step, ev, (p) => {
      const t = seatOf(p.responses[step.seat]);
      if (t == null || !ctx.alive(t)) return;
      const text = `白狼王${step.seat}号带走了${t}号`;
      ctx.log(text);
      ctx.pushFront(ctx.announce(text), ...killPlayers(ctx, [{ seat: t, cause: 'taken' }], 'day'));
    });
  },
});

const LOCKED = new Set(['deathSkill', 'badge', 'whiteWolfTake', 'explodeDie', 'roleCheck', 'checkWin']);

/** 当前步骤是否允许自爆 */
export function canExplodeNow(ctx: Ctx, seat: Seat): boolean {
  const s = ctx.s;
  if (s.phase !== 'day' || s.paused || !ctx.alive(seat)) return false;
  if (s.current && LOCKED.has(s.current.kind)) return false;
  const role = ctx.roleOf(seat);
  const ce = typeof role.canExplode === 'function' ? role.canExplode(ctx, seat) : !!role.canExplode;
  return ce;
}

export function canDuelNow(ctx: Ctx, seat: Seat): boolean {
  const s = ctx.s;
  if (s.phase !== 'day' || s.paused || !ctx.alive(seat)) return false;
  const p = ctx.player(seat);
  if (!getRole(p.role)?.dayActions?.includes('duel') || p.flags.dueled) return false;
  const cur = s.current;
  if (!cur || cur.election || (cur.kind !== 'speech' && cur.kind !== 'freeTalk') || cur.lastWords) return false;
  return true;
}

export function canWithdrawNow(ctx: Ctx, seat: Seat): boolean {
  const s = ctx.s;
  const el = s.election;
  if (s.phase !== 'day' || el.status !== 'running') return false;
  if (!el.candidates.includes(seat) || el.withdrawn.includes(seat)) return false;
  return !!s.current?.election && s.current.kind !== 'electionVote' && s.current.kind !== 'electionSignup';
}

export function dayAction(ctx: Ctx, seat: Seat, action: 'explode' | 'duel' | 'withdraw', target?: Seat) {
  const s = ctx.s;
  if (action === 'withdraw') {
    if (!canWithdrawNow(ctx, seat)) throw new RuleError('现在不能退水');
    s.election.withdrawn.push(seat);
    ctx.log(`${seat}号退水`);
    ctx.effects.push({ t: 'announce', id: ctx.id('a'), text: `${seat}号退水` });
    if (s.current?.kind === 'speech' && s.current.seat === seat) endCurrent(ctx);
    return;
  }

  if (action === 'explode') {
    if (!canExplodeNow(ctx, seat)) throw new RuleError('现在不能自爆');
    const inElection = s.election.status === 'running';
    const pendingAnnounce = s.agenda.some((st) => st.kind === 'announceDeaths');
    const cur = s.current;
    endCurrent(ctx);
    ctx.log(`${seat}号玩家自爆`);
    const steps: Step[] = [ctx.announce(`${seat}号玩家自爆`), { kind: 'explodeDie', seat }];
    if (inElection) {
      if (s.rules.electionExplode === 'double' && s.election.explodes === 0) {
        s.election.status = 'postponed';
        steps.push(ctx.announce('警长竞选顺延到明天'));
        ctx.log('警长竞选顺延到明天');
      } else {
        s.election.status = 'lost';
        steps.push(ctx.announce('警徽流失，本局没有警长'));
        ctx.log('警徽流失');
      }
      s.election.explodes++;
    }
    if (s.rules.explodeToNight) {
      s.agenda = [...steps, ...(pendingAnnounce ? [{ kind: 'announceDeaths' }] : []), { kind: 'checkWin' }, { kind: 'nightStart' }];
    } else {
      // 白天继续：当前环节（如正在进行的发言）被打断，竞选相关步骤在竞选结束时移除
      void cur;
      const rest = s.agenda.filter((st) => !(inElection && st.election));
      s.agenda = [...steps, { kind: 'checkWin' }, ...rest];
    }
    return;
  }

  // duel
  if (!canDuelNow(ctx, seat)) throw new RuleError('现在不能决斗');
  if (target == null || target === seat || !ctx.alive(target)) throw new RuleError('请选择一名存活的其他玩家');
  const cur = s.current!;
  endCurrent(ctx);
  ctx.player(seat).flags.dueled = true;
  const isWolf = ctx.side(target) === 'wolf';
  const intro = `${seat}号骑士翻牌，与${target}号决斗`;
  ctx.log(intro);
  if (isWolf) {
    const text = `${target}号是狼人，决斗成功`;
    ctx.log(text);
    const after = killPlayers(ctx, [{ seat: target, cause: 'duel' }], 'day');
    s.agenda = [ctx.announce(intro), ctx.announce(text), ...after, { kind: 'checkWin' }, { kind: 'nightStart' }];
  } else {
    const text = `${target}号是好人，骑士以死谢罪`;
    ctx.log(text);
    const after = killPlayers(ctx, [{ seat, cause: 'duelFail' }], 'day');
    s.agenda = [ctx.announce(intro), ctx.announce(text), ...after, { kind: 'checkWin' }, cur, ...s.agenda];
  }
}
