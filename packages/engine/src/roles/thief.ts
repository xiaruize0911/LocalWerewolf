import { RuleError, type Ctx } from '../ctx.ts';
import type { RoleId } from '../types.ts';
import { aliveWith } from './helpers.ts';
import { getRole } from './registry.ts';
import type { RoleDef } from './types.ts';

function allowed(ctx: Ctx): RoleId[] {
  const cards = ctx.s.extraCards;
  const isWolf = (r: RoleId) => getRole(r)?.faction === 'wolf';
  const wolves = cards.filter(isWolf);
  const rule = ctx.cfg('thief').mustTakeWolf;
  if (rule === 'any' && wolves.length) return wolves;
  return cards;
}

function become(ctx: Ctx, seat: number, role: RoleId): string {
  const p = ctx.player(seat);
  p.role = role;
  p.flags.wasThief = true;
  const text = `你选择了「${ctx.roleName(role)}」，现在你的身份是${ctx.roleName(role)}`;
  ctx.tell(seat, text);
  return text;
}

export const thief: RoleDef = {
  id: 'thief',
  name: '盗贼',
  faction: 'good',
  category: 'villager',
  short: '首夜从两张底牌中选一张作为自己的身份。',
  intro: {
    skill: '有盗贼的板子会多放两张身份牌作为底牌（总牌数 = 人数 + 2）。首夜盗贼查看两张底牌，选择其中一张成为自己的身份，之后按新身份行动。默认如果两张都是狼人牌，只能选狼人。',
    timing: '仅首夜第一个行动。',
    tips: ['没被选走的底牌对应的角色仍会被法官「唤醒」，以免泄露信息。'],
  },
  config: [
    { key: 'mustTakeWolf', group: '盗贼', label: '底牌有狼时', desc: '', type: 'select', default: 'both',
      options: [{ value: 'both', label: '两张都是狼才必须选狼' }, { value: 'any', label: '有一张狼就必须选狼' }] },
  ],
  night: [
    {
      id: 'thief', roles: ['thief'], order: 10, name: '盗贼', firstNightOnly: true,
      actors: (ctx) => aliveWith(ctx, 'thief'),
      spec: (ctx) => {
        const ok = allowed(ctx);
        return {
          type: 'choice', title: '请从两张底牌中选择你的身份',
          desc: `底牌：${ctx.s.extraCards.map((r) => ctx.roleName(r)).join('、')}`,
          options: [...new Set(ok)].map((r) => ({ value: r, label: ctx.roleName(r) })),
        };
      },
      submit: (ctx, seat, payload) => {
        const v = payload?.value;
        if (!allowed(ctx).includes(v)) throw new RuleError('不能选择这张牌');
        return become(ctx, seat, v);
      },
      timeout: (ctx, seat) => {
        become(ctx, seat, ctx.pick(allowed(ctx)));
      },
    },
  ],
};
