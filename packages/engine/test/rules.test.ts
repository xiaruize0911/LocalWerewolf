import { describe, expect, it } from 'vitest';
import { Sim } from './sim.ts';

// 座位：1-4 狼，5-8 民，9 预言家，10 女巫，11 猎人，12 白痴
const STD = ['werewolf', 'werewolf', 'werewolf', 'werewolf', 'villager', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter', 'idiot'];
// 守卫板：1-3 狼，4 狼王，5-8 民，9 预言家，10 女巫，11 猎人，12 守卫
const GUARD = ['werewolf', 'werewolf', 'werewolf', 'wolfKing', 'villager', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter', 'guard'];
const noSheriff = { sheriff: false };

describe('基础夜晚', () => {
  it('狼刀成功，天亮公布死讯', () => {
    const g = new Sim({ roles: STD, rules: noSheriff });
    g.nights[1] = { wolves: 5 };
    g.toDay(1);
    expect(g.dead()).toEqual([5]);
    expect(g.s.log.some((l) => l.text === '昨晚5号玩家死亡')).toBe(true);
  });

  it('女巫救人则平安夜', () => {
    const g = new Sim({ roles: STD, rules: noSheriff });
    g.nights[1] = { wolves: 5, witch: { save: true } };
    g.toDay(1);
    expect(g.dead()).toEqual([]);
    expect(g.s.log.some((l) => l.text === '昨晚是平安夜')).toBe(true);
  });

  it('预言家得到正确的查验结果', () => {
    const g = new Sim({ roles: STD, rules: noSheriff });
    g.nights[1] = { seer: 2 };
    g.toDay(1);
    expect(g.info(9).some((t) => t.includes('2号的身份是：狼人'))).toBe(true);
  });

  it('毒药与狼刀同时生效', () => {
    const g = new Sim({ roles: STD, rules: { ...noSheriff, witchBothPotions: false } });
    g.nights[1] = { wolves: 5, witch: { poison: 1 } };
    g.toDay(1);
    expect(g.dead().sort()).toEqual([1, 5]);
  });
});

describe('女巫规则', () => {
  it('首夜可以自救，第二夜不能', () => {
    const g = new Sim({ roles: STD, rules: noSheriff });
    g.nights[1] = { wolves: 10, witch: { save: true } };
    g.toDay(1);
    expect(g.alive(10)).toBe(true);
    // 第二夜：解药已用，无法再救
    g.nights[2] = { wolves: 10 };
    g.toDay(2);
    expect(g.alive(10)).toBe(false);
  });

  it('全程不能自救时首夜自救被拒绝', () => {
    const g = new Sim({ roles: STD, rules: { ...noSheriff, witchSelfSave: 'never' } });
    g.nights[1] = { wolves: 10 };
    g.runUntil((s) => s.current?.kind === 'nightAct' && s.current.id === 'witch' && s.prompts.length > 0);
    const p = g.s.prompts[0];
    const spec = p.specs[10];
    expect(spec.type === 'form' && spec.fields.some((f) => f.key === 'save')).toBe(false);
    expect(g.send({ t: 'submit', seat: 10, promptId: p.id, payload: { values: { save: true } } }, false)).toMatch(/解药|自救/);
  });

  it('默认一晚不能同时用两瓶药', () => {
    const g = new Sim({ roles: STD, rules: noSheriff });
    g.nights[1] = { wolves: 5 };
    g.runUntil((s) => s.current?.kind === 'nightAct' && s.current.id === 'witch' && s.prompts.length > 0);
    const p = g.s.prompts[0];
    expect(g.send({ t: 'submit', seat: 10, promptId: p.id, payload: { values: { save: true, poison: 1 } } }, false)).toMatch(/一瓶/);
  });
});

describe('守卫规则', () => {
  it('守卫挡刀', () => {
    const g = new Sim({ roles: GUARD, rules: noSheriff });
    g.nights[1] = { guard: 5, wolves: 5 };
    g.toDay(1);
    expect(g.dead()).toEqual([]);
  });

  it('同守同救默认死亡', () => {
    const g = new Sim({ roles: GUARD, rules: noSheriff });
    g.nights[1] = { guard: 5, wolves: 5, witch: { save: true } };
    g.toDay(1);
    expect(g.dead()).toEqual([5]);
  });

  it('同守同救可配置为存活', () => {
    const g = new Sim({ roles: GUARD, rules: { ...noSheriff, sameGuardSave: 'lives' } });
    g.nights[1] = { guard: 5, wolves: 5, witch: { save: true } };
    g.toDay(1);
    expect(g.dead()).toEqual([]);
  });

  it('守卫挡不住毒药', () => {
    const g = new Sim({ roles: GUARD, rules: noSheriff });
    g.nights[1] = { guard: 6, witch: { poison: 6 } };
    g.toDay(1);
    expect(g.dead()).toEqual([6]);
  });

  it('不能连续两晚守同一人', () => {
    const g = new Sim({ roles: GUARD, rules: noSheriff });
    g.nights[1] = { guard: 5 };
    g.toDay(1);
    g.runUntil((s) => s.day === 2 && s.current?.kind === 'nightAct' && s.current.id === 'guard' && s.prompts.length > 0);
    const spec = g.s.prompts[0].specs[12];
    expect(spec.type === 'pickSeat' && spec.candidates.includes(5)).toBe(false);
  });
});

describe('猎人与狼王', () => {
  it('被狼刀的猎人可以开枪', () => {
    const g = new Sim({ roles: STD, rules: noSheriff });
    g.nights[1] = { wolves: 11 };
    g.days[1] = { shoot: { 11: 1 } };
    g.runUntil((s) => s.day === 1 && s.phase === 'day' && s.current?.kind === 'discussion' || s.current?.kind === 'speech');
    expect(g.dead().sort((a, b) => a - b)).toEqual([1, 11]);
  });

  it('被毒的猎人不能开枪', () => {
    const g = new Sim({ roles: STD, rules: noSheriff });
    g.nights[1] = { witch: { poison: 11 } };
    g.runUntil((s) => s.current?.kind === 'deathSkill' && s.prompts.length > 0);
    expect(g.s.prompts[0].specs[11].type).toBe('confirm');
  });

  it('猎人夜里能看到开枪状态', () => {
    const g = new Sim({ roles: STD, rules: noSheriff });
    g.nights[1] = { witch: { poison: 11 } };
    g.runUntil((s) => s.current?.kind === 'nightAct' && s.current.id === 'hunter' && s.prompts.length > 0);
    const spec = g.s.prompts[0].specs[11];
    expect(spec.type === 'confirm' && spec.desc).toContain('不能开枪');
  });

  it('狼王被放逐可以开枪', () => {
    const g = new Sim({ roles: GUARD, rules: noSheriff });
    g.days[1] = { votes: 4, shoot: { 4: 9 } };
    g.toNight(2);
    expect(g.dead().sort((a, b) => a - b)).toEqual([4, 9]);
  });
});

describe('白痴', () => {
  it('被放逐时翻牌免死并失去投票权', () => {
    const g = new Sim({ roles: STD, rules: noSheriff });
    g.days[1] = { votes: 12 };
    g.toNight(2);
    expect(g.alive(12)).toBe(true);
    expect(g.view(null).players.find((p) => p.seat === 12)!.revealed).toBe('idiot');
    g.toDay(2);
    g.runUntil((s) => s.current?.kind === 'exileVote' && s.prompts.length > 0);
    expect(g.s.prompts[0].seats.includes(12)).toBe(false);
  });
});

describe('放逐平票', () => {
  const votes = { 1: 5, 2: 5, 3: 6, 4: 6 };
  it('PK 一轮后仍平票则平安日', () => {
    const g = new Sim({ roles: STD, rules: noSheriff });
    g.days[1] = { votes, pkVotes: { 1: 5, 2: 6 } };
    g.toNight(2);
    expect(g.dead()).toEqual([]);
    expect(g.s.log.some((l) => /平安日/.test(l.text))).toBe(true);
  });
  it('直接平安日', () => {
    const g = new Sim({ roles: STD, rules: { ...noSheriff, tieRule: 'none' } });
    g.days[1] = { votes };
    g.toNight(2);
    expect(g.s.votes.length).toBe(1);
  });
  it('PK 后得票最多者出局', () => {
    const g = new Sim({ roles: STD, rules: noSheriff });
    g.days[1] = { votes, pkVotes: 5 };
    g.toNight(2);
    expect(g.dead()).toEqual([5]);
  });
});

describe('胜负判定', () => {
  it('屠边：平民全部出局狼人获胜', () => {
    const g = new Sim({ roles: STD, rules: noSheriff });
    g.nights[1] = { wolves: 5 };
    g.days[1] = { votes: 6 };
    g.nights[2] = { wolves: 7 };
    g.days[2] = { votes: 8 };
    g.toEnd();
    expect(g.s.winner?.faction).toBe('wolf');
  });
  it('所有狼出局好人获胜', () => {
    const g = new Sim({ roles: ['werewolf', 'villager', 'villager', 'seer', 'witch', 'hunter'], rules: noSheriff });
    g.days[1] = { votes: 1 };
    g.toEnd();
    expect(g.s.winner?.faction).toBe('good');
  });
});

describe('发言', () => {
  it('关闭发言时只有自由讨论', () => {
    const g = new Sim({ roles: STD, rules: { ...noSheriff, speech: 'off' } });
    g.toDay(1);
    g.runUntil((s) => s.current?.kind === 'freeTalk' || s.current?.kind === 'exileVote');
    expect(g.s.current?.kind).toBe('freeTalk');
  });
  it('跳过所有发言直接投票', () => {
    const g = new Sim({ roles: STD, rules: noSheriff });
    g.toDay(1);
    g.runUntil((s) => s.current?.kind === 'speech');
    g.send({ t: 'host', action: 'skipAllSpeech' });
    g.runUntil((s) => s.current?.kind === 'exileVote' || s.current?.kind === 'speech');
    expect(g.s.current?.kind).toBe('exileVote');
  });
  it('首夜死者有遗言', () => {
    const g = new Sim({ roles: STD, rules: noSheriff });
    g.nights[1] = { wolves: 5 };
    g.toDay(1);
    g.runUntil((s) => s.current?.kind === 'speech');
    expect(g.s.current).toMatchObject({ seat: 5, lastWords: true });
  });
});
