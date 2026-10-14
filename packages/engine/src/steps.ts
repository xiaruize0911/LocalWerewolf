import type { Ctx } from './ctx.ts';
import type { Payload, Prompt, Seat, Step } from './types.ts';

export type StepEvent =
  | { t: 'timer'; id: string }
  | { t: 'deadline'; prompt: Prompt }
  | { t: 'submit'; prompt: Prompt; seat: Seat; payload: Payload }
  | { t: 'announceDone' }
  | { t: 'speechEnd'; seat: Seat }
  | { t: 'host'; action: 'nextSpeaker' | 'startVote' | 'advance' };

export interface StepHandler {
  /** 进入步骤：返回 true 表示已完成 */
  enter(ctx: Ctx, step: Step): boolean;
  /** 处理事件：返回 true 表示步骤完成 */
  on?(ctx: Ctx, step: Step, ev: StepEvent): boolean;
}

export const HANDLERS: Record<string, StepHandler> = {};

export function defineStep(kind: string, h: StepHandler) {
  HANDLERS[kind] = h;
}

/** 结束当前步骤并清理它拥有的提示与计时器 */
export function endCurrent(ctx: Ctx) {
  const s = ctx.s;
  s.current = null;
  s.prompts = [];
  s.timers = {};
  s.announce = null;
  s.speech = null;
}

/** 推进议程，直到某个步骤需要等待 */
export function run(ctx: Ctx) {
  const s = ctx.s;
  let guard = 0;
  while (!s.current && s.agenda.length && s.phase !== 'over') {
    if (++guard > 5000) throw new Error('议程陷入死循环');
    const step = s.agenda.shift()!;
    const h = HANDLERS[step.kind];
    if (!h) throw new Error(`未知步骤：${step.kind}`);
    s.current = step;
    if (h.enter(ctx, step)) endCurrent(ctx);
  }
}

/** 把事件交给当前步骤 */
export function route(ctx: Ctx, ev: StepEvent) {
  const step = ctx.s.current;
  if (!step) return;
  const h = HANDLERS[step.kind];
  if (h.on?.(ctx, step, ev)) endCurrent(ctx);
}

/** 公告步骤：等待大屏播报完毕（带上限） */
defineStep('announce', {
  enter(ctx, step) {
    const id = ctx.id('a');
    ctx.s.announce = { id, text: step.text };
    ctx.effects.push({ t: 'announce', id, text: step.text });
    ctx.timer('ann', 3000 + [...step.text].length * 450);
    return false;
  },
  on(_ctx, _step, ev) {
    return ev.t === 'announceDone' || (ev.t === 'timer' && ev.id === 'ann') || (ev.t === 'host' && ev.action === 'advance');
  },
});

defineStep('wait', {
  enter(ctx, step) {
    ctx.timer('wait', step.ms);
    return false;
  },
  on(_ctx, _step, ev) {
    return (ev.t === 'timer' && ev.id === 'wait') || (ev.t === 'host' && ev.action === 'advance');
  },
});
