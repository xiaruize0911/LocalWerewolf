import type { GameView, Payload, PromptSpec } from '@lw/engine';

const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

/** 测试用机器人：根据提示随机给出合法操作；狼人跟随队友的选择 */
export function botPayload(view: GameView): Payload {
  const p = view.prompt!;
  const spec: PromptSpec = p.spec;
  const intents = p.intents ? Object.values(p.intents) : [];
  if (intents.length) return intents[0];
  switch (spec.type) {
    case 'pickSeat': {
      const cands = spec.candidates.filter((s) => s !== view.me?.seat);
      if ((spec.allowSkip && Math.random() < 0.35) || !cands.length) return { seat: spec.allowSkip ? null : spec.candidates[0] };
      return { seat: pick(cands) };
    }
    case 'pickTwo': {
      if (spec.allowSkip && Math.random() < 0.5) return { seats: null };
      const a = pick(spec.candidates);
      const b = pick(spec.candidates.filter((x) => x !== a));
      return { seats: [a, b] };
    }
    case 'choice':
      return { value: pick(spec.options).value };
    case 'form':
      return { values: {} };
    default:
      return {};
  }
}

export function fallbackPayload(spec: PromptSpec): Payload {
  switch (spec.type) {
    case 'pickSeat': return { seat: spec.allowSkip ? null : spec.candidates[0] };
    case 'pickTwo': return { seats: spec.allowSkip ? null : spec.candidates.slice(0, 2) };
    case 'choice': return { value: spec.options[0].value };
    case 'form': return { values: {} };
    default: return {};
  }
}
