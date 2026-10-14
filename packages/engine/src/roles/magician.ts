import { RuleError, type Ctx } from '../ctx.ts';
import type { Seat } from '../types.ts';
import { aliveWith } from './helpers.ts';
import type { RoleDef } from './types.ts';

function candidates(ctx: Ctx): Seat[] {
  const used: Seat[] = ctx.rs('magician').used ?? [];
  const once = ctx.cfg('magician').swapOnce;
  return ctx.aliveSeats().filter((s) => !once || !used.includes(s));
}

export const magician: RoleDef = {
  id: 'magician',
  name: '魔术师',
  faction: 'good',
  category: 'god',
  short: '每晚最先行动，交换两名玩家的号码牌，当晚所有技能都作用在交换后的玩家身上。',
  intro: {
    skill: '每晚在其他角色之前行动，可以交换两名玩家的号码牌（当晚有效）。之后当晚所有指向其中一人的技能，都会作用到另一人身上，例如狼人刀 A 实际刀中 B。默认每个号码整局只能被交换一次。',
    timing: '每晚在噩梦之影之后、所有好人之前行动。',
    tips: ['交换自己和别人可以保护自己。', '交换后预言家查 A 得到的是 B 的身份。'],
  },
  config: [
    { key: 'swapOnce', group: '魔术师', label: '每个号码整局只能被交换一次', desc: '', type: 'select', default: true, options: [{ value: true, label: '是' }, { value: false, label: '否' }] },
  ],
  night: [
    {
      id: 'magician', roles: ['magician'], order: 55, name: '魔术师',
      actors: (ctx) => aliveWith(ctx, 'magician'),
      spec: (ctx) => ({ type: 'pickTwo', title: '请选择要交换号码的两名玩家', candidates: candidates(ctx), allowSkip: true, skipLabel: '不交换' }),
      submit: (ctx, seat, payload) => {
        const seats = payload?.seats;
        if (!seats) {
          ctx.s.night.swap = null;
          return '你今晚没有交换';
        }
        const [a, b] = seats.map(Number);
        const c = candidates(ctx);
        if (a === b || !c.includes(a) || !c.includes(b)) throw new RuleError('请选择两名不同的可交换玩家');
        ctx.s.night.swap = [a, b];
        (ctx.rs('magician').used ??= []).push(a, b);
        ctx.tell(seat, `第${ctx.s.night.night}夜：你交换了${a}号和${b}号`);
        return `你交换了${a}号和${b}号`;
      },
    },
  ],
};
