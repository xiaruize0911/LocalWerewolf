import type { Ctx } from '../ctx.ts';
import { allNightActions } from '../roles/registry.ts';
import type { NightAction } from '../roles/types.ts';
import { defineStep } from '../steps.ts';
import type { Board, NightCtx, PromptSpec, Seat } from '../types.ts';
import { resolveNight } from './resolve.ts';

const ALWAYS_CALL = ['guard', 'witch', 'seer', 'hunter'];

export function freshNight(night: number): NightCtx {
  return {
    night, fear: null, swap: null, dream: null, guard: null, wolfKill: null, wolfKill2: null, save: false,
    poison: null, poisonBy: null, machineGuard: null, machinePoison: null, hunt: null, hunter: null,
    charm: null, curse: null, silence: null, voteBan: null, checks: [], sealGood: false,
  };
}

/** 某个板子在第 n 晚会依次唤醒的步骤（按板子而不是存活玩家生成，死亡/不存在的角色也照常唤醒） */
export function nightSchedule(board: Board, night: number, callAbsent = false): NightAction[] {
  return allNightActions().filter((a) => {
    const present = a.roles.some((r) => (board[r] ?? 0) > 0) || (callAbsent && ALWAYS_CALL.includes(a.id));
    if (!present) return false;
    if (a.firstNightOnly && night !== 1) return false;
    if (a.fromNight && night < a.fromNight) return false;
    return true;
  });
}

const actionById = (id: string) => {
  const a = allNightActions().find((x) => x.id === id);
  if (!a) throw new Error(`未知夜间步骤 ${id}`);
  return a;
};

defineStep('nightStart', {
  enter(ctx) {
    const s = ctx.s;
    s.phase = 'night';
    s.day += 1;
    s.prevNight = s.night;
    s.night = freshNight(s.day);
    if (ctx.s.roleState.bloodMoon?.sealNight === s.day) {
      s.night.sealGood = true;
      ctx.log('血月使徒的封印生效：今晚所有好人的技能被封印');
    }
    ctx.stage(`第${s.day}夜`);
    ctx.log(`—— 第${s.day}夜 ——`);
    const steps = nightSchedule(s.board, s.day, !!s.rules.callAbsentRoles).map((a) => ({ kind: 'nightRole', id: a.id }));
    ctx.pushFront(ctx.announce('天黑请闭眼'), { kind: 'wait', ms: 2500 }, ...steps, { kind: 'dawn' });
    return true;
  },
});

defineStep('nightRole', {
  enter(ctx, step) {
    const a = actionById(step.id);
    ctx.pushFront(
      ctx.announce(a.wakeText ?? `${a.name}请睁眼`),
      { kind: 'nightAct', id: a.id },
      ctx.announce(a.sleepText ?? `${a.name}请闭眼`),
      { kind: 'wait', ms: 1200 + ctx.randInt(1800) },
    );
    return true;
  },
});

function blockedSpec(ctx: Ctx): PromptSpec {
  const text = ctx.s.night.sealGood ? '今晚你的技能被血月封印，无法行动。' : '你今晚被恐惧，无法使用技能。';
  return { type: 'confirm', title: '你今晚无法行动', desc: text, okLabel: '知道了' };
}

/** 夜间行动：开提示 → 等待全部提交或超时，且至少持续一个随机时长 */
defineStep('nightAct', {
  enter(ctx, step) {
    const a = actionById(step.id);
    const r = ctx.rules;
    ctx.timer('pad', (r.stepMin + ctx.rand() * r.stepJitter) * 1000);
    step.padDone = false;
    const actors = a.actors(ctx);
    if (!actors.length) return false;
    const blocked = (seat: Seat) => !a.unblockable && ctx.isBlocked(seat);
    const prompt = ctx.openPrompt({
      purpose: 'night',
      seats: actors,
      group: a.group,
      timeoutSec: r.nightTimeout,
      spec: (seat) => (blocked(seat) ? blockedSpec(ctx) : a.spec(ctx, seat)),
    });
    step.promptId = prompt.id;
    step.blocked = actors.filter(blocked);
    if (a.group && actors.every(blocked)) {
      a.finish?.(ctx, {}, true);
      step.groupDone = true;
    }
    return false;
  },
  on(ctx, step, ev) {
    const a = actionById(step.id);
    const prompt = ctx.s.prompts.find((p) => p.id === step.promptId);
    const blocked: Seat[] = step.blocked ?? [];
    const finishTimeout = () => {
      if (!prompt || prompt.closed) return;
      if (a.group) {
        if (!step.groupDone) a.finish?.(ctx, prompt.responses, true);
      } else {
        for (const seat of prompt.seats) {
          if (!prompt.responses[seat] && !blocked.includes(seat)) {
            const fb = a.timeout?.(ctx, seat);
            if (fb) prompt.feedback[seat] = fb;
          }
        }
      }
      ctx.closePrompt(prompt);
    };
    switch (ev.t) {
      case 'timer':
        if (ev.id === 'pad') step.padDone = true;
        break;
      case 'deadline':
        finishTimeout();
        break;
      case 'host':
        if (ev.action === 'advance') {
          finishTimeout();
          step.padDone = true;
        }
        break;
      case 'submit': {
        if (!prompt) break;
        if (!blocked.includes(ev.seat)) {
          const fb = a.submit(ctx, ev.seat, ev.payload);
          if (fb) prompt.feedback[ev.seat] = fb;
        }
        prompt.responses[ev.seat] = ev.payload;
        if (a.group) {
          const active = prompt.seats.filter((s) => !blocked.includes(s));
          const keys = active.map((s) => JSON.stringify(prompt.responses[s] ?? null));
          if (!step.groupDone && active.every((s) => prompt.responses[s]) && keys.every((k) => k === keys[0])) {
            a.finish?.(ctx, prompt.responses, false);
            step.groupDone = true;
          }
          if (step.groupDone && prompt.seats.every((s) => prompt.responses[s])) ctx.closePrompt(prompt);
        } else if (prompt.seats.every((s) => prompt.responses[s])) {
          ctx.closePrompt(prompt);
        }
        break;
      }
    }
    if (a.group && step.groupDone && prompt && !prompt.closed) {
      // 狼刀已统一：被封印的狼也无需再等
      if (prompt.seats.filter((s) => !blocked.includes(s)).every((s) => prompt.responses[s])) ctx.closePrompt(prompt);
    }
    return step.padDone && (!prompt || prompt.closed);
  },
});

defineStep('dawn', {
  enter(ctx) {
    ctx.s.pendingDeaths = resolveNight(ctx);
    ctx.pushFront({ kind: 'dayStart' });
    return true;
  },
});
