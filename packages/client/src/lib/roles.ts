import { getRole, ROLE_LIST, type RoleDef } from '@lw/engine';

export const CATEGORY_LABEL: Record<string, string> = { god: '神职', villager: '平民', wolf: '狼人阵营', third: '第三方' };

export const CATEGORY_STYLE: Record<string, string> = {
  god: 'bg-amber-400/15 text-amber-200 border-amber-400/30',
  villager: 'bg-emerald-400/15 text-emerald-200 border-emerald-400/30',
  wolf: 'bg-rose-500/15 text-rose-200 border-rose-500/30',
  third: 'bg-pink-400/15 text-pink-200 border-pink-400/30',
};

export const ROLE_EMOJI: Record<string, string> = {
  werewolf: '🐺', villager: '🧑‍🌾', seer: '🔮', witch: '🧪', hunter: '🔫', idiot: '🤪', guard: '🛡️',
  wolfKing: '👑', whiteWolfKing: '🤍', knight: '⚔️', psychic: '👁️', machineWolf: '🤖', gargoyle: '🗿',
  graveKeeper: '⚰️', evilKnight: '🖤', nightmare: '🌑', dreamer: '💤', demonHunter: '🏹', crow: '🐦‍⬛',
  magician: '🎩', bloodMoon: '🩸', wolfBeauty: '💋', hiddenWolf: '🫥', cupid: '💘', thief: '🦹',
  wildChild: '🧒', mixedBlood: '🧬', silencer: '🤐', voteBanner: '🚫', bearTamer: '🐻',
};

export const roleName = (id: string) => getRole(id)?.name ?? id;
export const roleEmoji = (id: string) => ROLE_EMOJI[id] ?? '❔';
export const roleStyle = (id: string) => CATEGORY_STYLE[getRole(id)?.category ?? 'villager'];

export function rolesByCategory(): [string, RoleDef[]][] {
  const order = ['wolf', 'god', 'villager', 'third'];
  return order.map((c) => [c, ROLE_LIST.filter((r) => r.category === c)] as [string, RoleDef[]]);
}

export const TEAM_LABEL: Record<string, string> = { good: '好人阵营', wolf: '狼人阵营', third: '第三方', aborted: '已终止' };
