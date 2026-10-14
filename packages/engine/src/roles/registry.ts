import type { RoleId } from '../types.ts';
import type { NightAction, RoleDef } from './types.ts';
import { werewolf } from './werewolf.ts';
import { villager } from './villager.ts';
import { seer } from './seer.ts';
import { witch } from './witch.ts';
import { hunter } from './hunter.ts';
import { idiot } from './idiot.ts';
import { guard } from './guard.ts';
import { wolfKing } from './wolfKing.ts';
import { whiteWolfKing } from './whiteWolfKing.ts';
import { knight } from './knight.ts';
import { psychic } from './psychic.ts';
import { machineWolf } from './machineWolf.ts';
import { gargoyle } from './gargoyle.ts';
import { graveKeeper } from './graveKeeper.ts';
import { evilKnight } from './evilKnight.ts';
import { nightmare } from './nightmare.ts';
import { dreamer } from './dreamer.ts';
import { demonHunter } from './demonHunter.ts';
import { crow } from './crow.ts';
import { magician } from './magician.ts';
import { bloodMoon } from './bloodMoon.ts';
import { wolfBeauty } from './wolfBeauty.ts';
import { hiddenWolf } from './hiddenWolf.ts';
import { cupid } from './cupid.ts';
import { thief } from './thief.ts';
import { wildChild } from './wildChild.ts';
import { mixedBlood } from './mixedBlood.ts';
import { silencer } from './silencer.ts';
import { voteBanner } from './voteBanner.ts';
import { bearTamer } from './bearTamer.ts';

/** 新增角色：新建一个文件并在这里注册一行。顺序即角色介绍页的展示顺序（按常见程度）。 */
export const ROLE_LIST: RoleDef[] = [
  werewolf, villager, seer, witch, hunter, idiot, guard,
  wolfKing, whiteWolfKing, knight,
  psychic, machineWolf, gargoyle, graveKeeper, evilKnight, nightmare, dreamer, demonHunter,
  crow, magician, bloodMoon, wolfBeauty, hiddenWolf,
  cupid, thief, wildChild, mixedBlood, silencer, voteBanner, bearTamer,
];

export const ROLES: Record<RoleId, RoleDef> = Object.fromEntries(ROLE_LIST.map((r) => [r.id, r]));

export function getRole(id: RoleId): RoleDef | undefined {
  return ROLES[id];
}

/** 所有夜间步骤（去重后按顺序） */
export function allNightActions(): NightAction[] {
  const map = new Map<string, NightAction>();
  for (const r of ROLE_LIST) for (const a of r.night ?? []) map.set(a.id, a);
  return [...map.values()].sort((a, b) => a.order - b.order);
}
