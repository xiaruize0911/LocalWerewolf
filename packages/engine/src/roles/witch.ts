import { RuleError, type Ctx } from '../ctx.ts';
import type { FormField, Seat } from '../types.ts';
import { aliveWith, othersAlive } from './helpers.ts';
import type { RoleDef } from './types.ts';

export function witchState(ctx: Ctx, seat: Seat): { antidote: boolean; poison: boolean } {
  return (ctx.rs('witch')[seat] ??= { antidote: true, poison: true });
}

function canSelfSave(ctx: Ctx): boolean {
  const r = ctx.rules.witchSelfSave;
  return r === 'always' || (r === 'firstNight' && ctx.s.night.night === 1);
}

function knifeText(ctx: Ctx): string {
  const { wolfKill, wolfKill2 } = ctx.s.night;
  const ks = [wolfKill, wolfKill2].filter((x): x is number => x != null);
  if (!ks.length) return '今晚没有玩家被袭击（平安夜）。';
  return `今晚 ${[...new Set(ks)].map((k) => `${k}号`).join('、')} 被袭击了。`;
}

export const witch: RoleDef = {
  id: 'witch',
  name: '女巫',
  faction: 'good',
  category: 'god',
  short: '拥有一瓶解药和一瓶毒药，各只能用一次。',
  intro: {
    skill: '有一瓶解药和一瓶毒药，整局各用一次。法官会告诉你当晚谁被狼人袭击，你可以用解药救他，也可以用毒药毒死一名玩家。',
    timing: '每晚，狼人之后、预言家之前行动。',
    tips: [
      '首夜救人通常收益最高，被救下的人叫「银水」。',
      '毒药要谨慎使用，毒错好人损失很大。',
      '用完解药后，默认法官不再告诉你刀口。',
    ],
    interactions: [
      '守卫守护和解药落在同一人身上时（同守同救），该玩家仍然死亡。',
      '守卫挡不住毒药；猎人被毒死不能开枪。',
      '毒恶灵骑士会被反伤，第二天女巫出局。猎魔人免疫毒药。',
    ],
    variants: ['女巫能否自救', '一晚能否用两瓶药', '解药用完后是否知道刀口'],
  },
  learnText: '获得一瓶毒药（仅一次），下一晚起可用',
  night: [
    {
      id: 'witch', roles: ['witch'], order: 100, name: '女巫',
      actors: (ctx) => aliveWith(ctx, 'witch'),
      spec: (ctx, seat) => {
        const st = witchState(ctx, seat);
        const knife = ctx.s.night.wolfKill;
        const knows = st.antidote || ctx.rules.witchKnowsAfterSave;
        const fields: FormField[] = [];
        if (st.antidote && knife != null && (knife !== seat || canSelfSave(ctx))) {
          fields.push({ key: 'save', label: `使用解药救 ${knife}号`, kind: 'toggle', optional: true });
        }
        if (st.poison) {
          fields.push({ key: 'poison', label: '使用毒药', kind: 'seat', candidates: othersAlive(ctx, seat), optional: true });
        }
        let desc = knows ? knifeText(ctx) : '你的解药已用完，法官不再告知刀口。';
        if (st.antidote && knife === seat && !canSelfSave(ctx)) desc += '\n（你不能自救）';
        if (!ctx.rules.witchBothPotions && fields.length === 2) desc += '\n一晚只能使用一瓶药。';
        if (!fields.length) return { type: 'confirm', title: '女巫请行动', desc: `${desc}\n你今晚没有可用的药。`, okLabel: '知道了' };
        return { type: 'form', title: '女巫请行动', desc, fields, okLabel: '确认' };
      },
      submit: (ctx, seat, payload) => {
        const st = witchState(ctx, seat);
        const v = payload?.values ?? {};
        const save = !!v.save;
        const poison = v.poison == null ? null : Number(v.poison);
        const knife = ctx.s.night.wolfKill;
        if (save && (!st.antidote || knife == null)) throw new RuleError('无法使用解药');
        if (save && knife === seat && !canSelfSave(ctx)) throw new RuleError('不能自救');
        if (poison != null && (!st.poison || !othersAlive(ctx, seat).includes(poison))) throw new RuleError('无法对该玩家使用毒药');
        if (save && poison != null && !ctx.rules.witchBothPotions) throw new RuleError('一晚只能使用一瓶药');
        const out: string[] = [];
        if (save) {
          st.antidote = false;
          ctx.s.night.save = true;
          out.push(`你用解药救了${knife}号`);
        }
        if (poison != null) {
          st.poison = false;
          ctx.s.night.poison = ctx.target(poison);
          ctx.s.night.poisonBy = seat;
          out.push(`你对${poison}号使用了毒药`);
        }
        const text = out.length ? out.join('；') : '你今晚没有用药';
        ctx.tell(seat, `第${ctx.s.night.night}夜：${text}`);
        return text;
      },
    },
  ],
};
