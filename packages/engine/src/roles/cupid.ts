import { RuleError } from '../ctx.ts';
import { aliveWith } from './helpers.ts';
import type { RoleDef } from './types.ts';

export const cupid: RoleDef = {
  id: 'cupid',
  name: '丘比特',
  faction: 'good',
  category: 'third',
  short: '首夜连接两名玩家成为情侣，情侣同生共死。',
  intro: {
    skill: '首夜选择两名玩家（可以包括自己）成为情侣。情侣中一人出局，另一人立即殉情。若情侣是一好一狼（人狼恋），情侣和丘比特组成第三方阵营：除他们以外的玩家全部出局时第三方获胜。丘比特既不算神也不算民。',
    timing: '仅首夜行动，在盗贼之后。',
    tips: [
      '情侣会在「情侣请睁眼」时互相确认，手机上会显示你的情侣是几号。',
      '人狼恋的情侣需要隐藏关系，同时消灭好人和狼人。',
    ],
    variants: ['人狼恋是否成为第三方'],
  },
  countsAs: () => null,
  night: [
    {
      id: 'cupid', roles: ['cupid'], order: 20, name: '丘比特', firstNightOnly: true,
      actors: (ctx) => aliveWith(ctx, 'cupid'),
      spec: (ctx) => ({ type: 'pickTwo', title: '请选择两名玩家成为情侣', desc: '可以选择自己。', candidates: ctx.aliveSeats() }),
      submit: (ctx, seat, payload) => {
        const seats = payload?.seats;
        if (!seats) throw new RuleError('请选择两名玩家');
        const [a, b] = seats.map(Number);
        if (a === b || !ctx.alive(a) || !ctx.alive(b)) throw new RuleError('请选择两名不同的玩家');
        const st = ctx.rs('cupid');
        st.lovers = [a, b];
        st.third = ctx.rules.humanWolfLovers === 'third' && ctx.side(a) !== ctx.side(b);
        ctx.tell(seat, `你连接了${a}号和${b}号成为情侣`);
        return `你连接了${a}号和${b}号成为情侣`;
      },
      timeout: (ctx, seat) => {
        const [a, b] = ctx.shuffle(ctx.aliveSeats()).slice(0, 2);
        const st = ctx.rs('cupid');
        st.lovers = [a, b];
        st.third = ctx.rules.humanWolfLovers === 'third' && ctx.side(a) !== ctx.side(b);
        ctx.tell(seat, `超时，系统随机连接了${a}号和${b}号`);
      },
    },
    {
      id: 'lovers', roles: ['cupid'], order: 30, name: '情侣', firstNightOnly: true, unblockable: true,
      actors: (ctx) => (ctx.rs('cupid').lovers ?? []).filter((s: number) => ctx.alive(s)),
      spec: (ctx, seat) => {
        const st = ctx.rs('cupid');
        const other = st.lovers.find((s: number) => s !== seat);
        const third = st.third ? '\n你们是人狼恋，与丘比特组成第三方阵营：除你们以外的玩家全部出局时获胜。' : '';
        return { type: 'confirm', title: '你被丘比特选为情侣', desc: `你的情侣是 ${other}号。一人出局，另一人会立即殉情。${third}`, okLabel: '知道了' };
      },
      submit: (ctx, seat) => {
        const st = ctx.rs('cupid');
        const other = st.lovers.find((s: number) => s !== seat);
        ctx.tell(seat, `你的情侣是${other}号${st.third ? '（人狼恋，第三方阵营）' : ''}`);
      },
      timeout: (ctx, seat) => {
        const st = ctx.rs('cupid');
        const other = st.lovers.find((s: number) => s !== seat);
        ctx.tell(seat, `你的情侣是${other}号${st.third ? '（人狼恋，第三方阵营）' : ''}`);
      },
    },
  ],
};
