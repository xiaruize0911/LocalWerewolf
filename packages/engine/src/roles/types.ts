import type { Ctx } from '../ctx.ts';
import type { RuleDef } from '../rules.ts';
import type { Category, Faction, Payload, PromptSpec, RoleId, Seat, Step } from '../types.ts';

export interface RoleIntro {
  /** 技能详解 */
  skill: string;
  /** 行动时机 */
  timing: string;
  /** 新手提示 */
  tips: string[];
  /** 与其他角色的互动 */
  interactions?: string[];
  /** 常见规则变体（可在规则选项里调整） */
  variants?: string[];
}

export interface NightAction {
  id: string;
  /** 板子上有这些角色之一时就会唤醒该步骤 */
  roles: RoleId[];
  order: number;
  /** 播报用名称："守卫请睁眼" */
  name: string;
  wakeText?: string;
  sleepText?: string;
  firstNightOnly?: boolean;
  fromNight?: number;
  /** 狼人：群体决策 */
  group?: boolean;
  /** 不受恐惧/封印影响（例如情侣互认） */
  unblockable?: boolean;
  /** 当晚行动者（存活） */
  actors(ctx: Ctx): Seat[];
  spec(ctx: Ctx, seat: Seat): PromptSpec;
  /** 校验并记录，返回给行动者的私密反馈；非法时抛 RuleError */
  submit(ctx: Ctx, seat: Seat, payload: Payload): string | void;
  /** 群体决策结束 / 超时处理 */
  finish?(ctx: Ctx, responses: Record<Seat, Payload>, timedOut: boolean): void;
  timeout?(ctx: Ctx, seat: Seat): string | void;
}

export interface RoleDef {
  id: RoleId;
  name: string;
  faction: Faction;
  category: Category;
  /** 一句话技能 */
  short: string;
  intro: RoleIntro;
  /** 角色专属规则选项 */
  config?: RuleDef[];
  /** 狼队成员：夜里与狼人一起睁眼、互相可见、默认参与狼刀 */
  wolfTeam?: boolean;
  /** 能看到狼队但狼队看不到他（隐狼） */
  seesWolfTeam?: boolean;
  /** 不与狼队见面，其他狼全部出局后才获得狼刀（机械狼、石像鬼） */
  loneWolf?: boolean;
  canExplode?: boolean | ((ctx: Ctx, seat: Seat) => boolean);
  /** 自爆时追加的步骤（白狼王带人、血月使徒封印） */
  onExplode?(ctx: Ctx, seat: Seat): Step[];
  /** 出局时可开枪 */
  shooter?: boolean | ((ctx: Ctx, seat: Seat) => boolean);
  joinsWolfKill?(ctx: Ctx, seat: Seat): boolean;
  side?(ctx: Ctx, seat: Seat): 'good' | 'wolf';
  seerSees?(ctx: Ctx, seat: Seat): 'good' | 'wolf';
  exactSees?(ctx: Ctx, seat: Seat): RoleId;
  countsAs?(ctx: Ctx, seat: Seat): 'wolf' | 'god' | 'villager' | null;
  night?: NightAction[];
  /** 被放逐时调用，返回 true 表示角色自行处理（不死亡） */
  onExiled?(ctx: Ctx, seat: Seat): boolean;
  /** 能否投票 */
  canVote?(ctx: Ctx, seat: Seat): boolean;
  /** 天亮公布死讯后触发（驯熊师熊咆哮等），返回要插入的步骤 */
  dayStart?(ctx: Ctx): Step[];
  /** 白天主动技能 */
  dayActions?: ('duel')[];
  /** 被机械狼学习后获得的效果说明 */
  learnText?: string;
}
