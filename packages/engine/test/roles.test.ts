import { describe, expect, it } from 'vitest';
import { Sim } from './sim.ts';

const noSheriff = { sheriff: false };

describe('机械狼与通灵师', () => {
  // 1-3 狼，4 机械狼，5-8 民，9 通灵师，10 女巫，11 猎人，12 守卫
  const MP = ['werewolf', 'werewolf', 'werewolf', 'machineWolf', 'villager', 'villager', 'villager', 'villager', 'psychic', 'witch', 'hunter', 'guard'];

  it('未学习的机械狼被通灵师验为狼人，学习后显示学到的身份', () => {
    const g = new Sim({ roles: MP, rules: noSheriff });
    g.nights[1] = { psychic: 4 };
    g.toDay(1);
    expect(g.info(9).some((t) => t.includes('4号的身份是：狼人'))).toBe(true);
    g.nights[2] = { machineWolf: 10, psychic: 4 };
    g.toDay(2);
    expect(g.info(4).some((t) => t.includes('他的身份是女巫'))).toBe(true);
    expect(g.info(9).some((t) => t.includes('4号的身份是：女巫'))).toBe(true);
  });

  it('学到女巫后下一晚可以用毒', () => {
    const g = new Sim({ roles: MP, rules: noSheriff });
    g.nights[1] = { machineWolf: 10 };
    g.nights[2] = { machineWolf: 6 };
    g.toDay(2);
    expect(g.alive(6)).toBe(false);
  });

  it('学到守卫的守护可以挡毒', () => {
    const g = new Sim({ roles: MP, rules: noSheriff });
    g.nights[1] = { machineWolf: 12 };
    g.nights[2] = { machineWolf: 7, witch: { poison: 7 } };
    g.toDay(2);
    expect(g.alive(7)).toBe(true);
  });

  it('其他狼人出局前机械狼没有狼刀', () => {
    const g = new Sim({ roles: MP, rules: noSheriff });
    g.runUntil((s) => s.current?.kind === 'nightAct' && s.current.id === 'wolves' && s.prompts.length > 0);
    expect(g.s.prompts[0].seats).toEqual([1, 2, 3]);
  });

  it('学猎人当晚即可开枪', () => {
    const g = new Sim({ roles: MP, rules: noSheriff });
    g.nights[1] = { machineWolf: 11 };
    g.days[1] = { votes: 4, shoot: { 4: 9 } };
    g.toNight(2);
    expect(g.alive(9)).toBe(false);
  });

  it('学狼人得到双刀，双刀同一人无视解药', () => {
    // 2 狼 + 机械狼：先投出两名狼，机械狼拿到刀
    const roles = ['werewolf', 'werewolf', 'machineWolf', 'villager', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter', 'guard', 'villager'];
    const g = new Sim({ roles, rules: { ...noSheriff, winMode: 'city' } });
    g.nights[1] = { machineWolf: 1, wolves: null };
    g.days[1] = { votes: 1 };
    g.nights[2] = { wolves: null };
    g.days[2] = { votes: 2 };
    g.nights[3] = { wolves: { target: 4, target2: 4 }, witch: { save: true } };
    g.toDay(3);
    expect(g.alive(4)).toBe(false);
  });
});

describe('恶灵骑士', () => {
  const EK = ['werewolf', 'werewolf', 'werewolf', 'evilKnight', 'villager', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter', 'guard'];
  it('被预言家查验时预言家死亡', () => {
    const g = new Sim({ roles: EK, rules: noSheriff });
    g.nights[1] = { seer: 4 };
    g.toDay(1);
    expect(g.dead()).toEqual([9]);
  });
  it('被毒时女巫死亡，自己不死', () => {
    const g = new Sim({ roles: EK, rules: noSheriff });
    g.nights[1] = { witch: { poison: 4 } };
    g.toDay(1);
    expect(g.dead()).toEqual([10]);
  });
  it('狼刀刀不死恶灵骑士', () => {
    const g = new Sim({ roles: EK, rules: noSheriff });
    g.nights[1] = { wolves: 4 };
    g.toDay(1);
    expect(g.dead()).toEqual([]);
  });
});

describe('魔术师、摄梦人、噩梦之影', () => {
  it('魔术师交换后狼刀落到另一人身上', () => {
    const roles = ['werewolf', 'werewolf', 'villager', 'villager', 'magician', 'seer', 'witch', 'villager'];
    const g = new Sim({ roles, rules: noSheriff });
    g.nights[1] = { magician: [3, 4], wolves: 3 };
    g.toDay(1);
    expect(g.dead()).toEqual([4]);
  });

  it('梦游者免疫狼刀；摄梦人夜里死亡时梦游者一起出局', () => {
    const roles = ['werewolf', 'werewolf', 'villager', 'villager', 'dreamer', 'seer', 'witch', 'villager'];
    const g = new Sim({ roles, rules: noSheriff });
    g.nights[1] = { dreamer: 3, wolves: 3 };
    g.toDay(1);
    expect(g.dead()).toEqual([]);
    g.nights[2] = { dreamer: 4, wolves: 5 };
    g.toDay(2);
    expect(g.dead().sort()).toEqual([4, 5]);
  });

  it('连续两晚梦游会死亡', () => {
    const roles = ['werewolf', 'werewolf', 'villager', 'villager', 'dreamer', 'seer', 'witch', 'villager'];
    const g = new Sim({ roles, rules: noSheriff });
    g.nights[1] = { dreamer: 3 };
    g.nights[2] = { dreamer: 3 };
    g.toDay(2);
    expect(g.dead()).toEqual([3]);
  });

  it('被噩梦之影恐惧的女巫无法用药', () => {
    const roles = ['werewolf', 'nightmare', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter'];
    const g = new Sim({ roles, rules: noSheriff });
    g.nights[1] = { nightmare: 7, wolves: 3, witch: { save: true } };
    g.toDay(1);
    expect(g.dead()).toEqual([3]);
  });
});

describe('丘比特与情侣', () => {
  it('情侣一方死亡另一方殉情；人狼恋为第三方', () => {
    const roles = ['werewolf', 'werewolf', 'villager', 'villager', 'cupid', 'seer', 'witch', 'hunter'];
    const g = new Sim({ roles, rules: noSheriff });
    g.nights[1] = { cupid: [1, 3], wolves: 4 };
    g.toDay(1);
    expect(g.s.roleState.cupid.third).toBe(true);
    expect(g.view(1).me!.lover).toBe(3);
    expect(g.view(2).me!.lover).toBe(null);
    g.days[1] = { votes: 3 };
    g.toNight(2);
    expect(g.dead().sort()).toEqual([1, 3, 4]);
  });
});

describe('盗贼', () => {
  it('盗贼从底牌中选择身份', () => {
    const roles = ['thief', 'werewolf', 'villager', 'villager', 'villager', 'witch'];
    const g = new Sim({ roles, extraCards: ['seer', 'werewolf'], rules: noSheriff });
    g.nights[1] = { thief: 'seer', seer: 2 };
    g.toDay(1);
    expect(g.role(1)).toBe('seer');
    expect(g.info(1).some((t) => t.includes('2号的身份是：狼人'))).toBe(true);
  });
});

describe('野孩子', () => {
  it('榜样死亡后野孩子变狼', () => {
    const roles = ['werewolf', 'werewolf', 'wildChild', 'villager', 'villager', 'seer', 'witch', 'hunter'];
    const g = new Sim({ roles, rules: noSheriff });
    g.nights[1] = { wildChild: 4, wolves: 4 };
    g.toDay(1);
    expect(g.view(3).me!.side).toBe('wolf');
    g.toNight(2);
    g.runUntil((s) => s.current?.kind === 'nightAct' && s.current.id === 'wolves' && s.prompts.length > 0);
    expect(g.s.prompts[0].seats).toContain(3);
  });
});

describe('警长', () => {
  const STD = ['werewolf', 'werewolf', 'werewolf', 'werewolf', 'villager', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter', 'idiot'];
  it('只有一人上警时自动当选，警长 1.5 票', () => {
    const g = new Sim({ roles: STD });
    g.days[1] = { run: [9], votes: { 9: 5, 1: 6 } };
    g.toNight(2);
    expect(g.s.sheriff).toBe(9);
    expect(g.dead()).toEqual([5]);
  });
  it('警上投票选出警长', () => {
    const g = new Sim({ roles: STD });
    g.days[1] = { run: [9, 1], electionVotes: 9 };
    g.toNight(2);
    expect(g.s.sheriff).toBe(9);
  });
  it('竞选阶段自爆默认警徽流失并入夜', () => {
    const g = new Sim({ roles: STD });
    let done = false;
    g.days[1] = {
      run: [9, 1],
      onSpeech: (sim) => {
        if (done) return;
        done = true;
        sim.send({ t: 'dayAction', seat: 1, action: 'explode' });
      },
    };
    g.toNight(2);
    expect(g.s.election.status).toBe('lost');
    expect(g.alive(1)).toBe(false);
    expect(g.s.votes.length).toBe(0);
  });
  it('双爆吞警徽：首次自爆竞选顺延到第二天', () => {
    const g = new Sim({ roles: STD, rules: { electionExplode: 'double' } });
    let done = false;
    g.days[1] = { run: [9, 1], onSpeech: (sim) => { if (!done) { done = true; sim.send({ t: 'dayAction', seat: 1, action: 'explode' }); } } };
    g.days[2] = { run: [9] };
    g.toNight(3);
    expect(g.s.sheriff).toBe(9);
  });
  it('警长死亡移交警徽', () => {
    const g = new Sim({ roles: STD });
    g.days[1] = { run: [9] };
    g.nights[2] = { wolves: 9 };
    g.days[2] = { badge: 10 };
    g.toNight(3);
    expect(g.s.sheriff).toBe(10);
  });
});

describe('骑士与白狼王', () => {
  const WK = ['werewolf', 'werewolf', 'werewolf', 'whiteWolfKing', 'villager', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter', 'knight'];
  it('骑士决斗狼人成功并立即入夜', () => {
    const g = new Sim({ roles: WK, rules: { sheriff: false } });
    let done = false;
    g.days[1] = { onSpeech: (sim) => { if (!done) { done = true; sim.send({ t: 'dayAction', seat: 12, action: 'duel', target: 2 }); } } };
    g.toNight(2);
    expect(g.dead()).toEqual([2]);
    expect(g.s.votes.length).toBe(0);
  });
  it('骑士决斗好人则骑士出局，白天继续', () => {
    const g = new Sim({ roles: WK, rules: { sheriff: false } });
    let done = false;
    g.days[1] = { votes: 1, onSpeech: (sim) => { if (!done) { done = true; sim.send({ t: 'dayAction', seat: 12, action: 'duel', target: 5 }); } } };
    g.toNight(2);
    expect(g.dead().sort((a, b) => a - b)).toEqual([1, 12]);
  });
  it('白狼王自爆带人', () => {
    const g = new Sim({ roles: WK, rules: { sheriff: false } });
    let done = false;
    g.days[1] = { onSpeech: (sim) => { if (!done) { done = true; sim.send({ t: 'dayAction', seat: 4, action: 'explode' }); } } };
    g.responder = (sim, seat, spec) => (sim.s.current?.kind === 'whiteWolfTake' ? { seat: 9 } : undefined);
    g.toNight(2);
    expect(g.dead().sort((a, b) => a - b)).toEqual([4, 9]);
  });
});

describe('其他神职', () => {
  it('守墓人得知前一天放逐者的阵营', () => {
    const roles = ['werewolf', 'werewolf', 'villager', 'villager', 'graveKeeper', 'seer', 'witch', 'hunter'];
    const g = new Sim({ roles, rules: { sheriff: false } });
    g.days[1] = { votes: 1 };
    g.toDay(2);
    expect(g.info(5).some((t) => t.includes('1号是：狼人'))).toBe(true);
  });
  it('猎魔人狩猎狼人成功，狩猎好人自己出局', () => {
    const roles = ['werewolf', 'werewolf', 'villager', 'villager', 'demonHunter', 'seer', 'witch', 'villager'];
    const g = new Sim({ roles, rules: { sheriff: false, winMode: 'city' } });
    g.nights[2] = { demonHunter: 1 };
    g.toDay(2);
    expect(g.alive(1)).toBe(false);
    g.nights[3] = { demonHunter: 3 };
    g.toDay(3);
    expect(g.alive(5)).toBe(false);
  });
  it('乌鸦诅咒额外一票', () => {
    const roles = ['werewolf', 'werewolf', 'villager', 'villager', 'crow', 'seer', 'witch', 'hunter'];
    const g = new Sim({ roles, rules: { sheriff: false } });
    g.nights[1] = { crow: 3 };
    g.days[1] = { votes: { 1: 4, 2: 3 } };
    g.toNight(2);
    expect(g.dead()).toEqual([3]);
  });
  it('驯熊师：邻座有狼时熊咆哮', () => {
    const roles = ['werewolf', 'bearTamer', 'villager', 'werewolf', 'villager', 'seer', 'witch', 'hunter'];
    const g = new Sim({ roles, rules: { sheriff: false } });
    g.toDay(1);
    g.runUntil((s) => s.log.some((l) => /熊/.test(l.text)));
    expect(g.s.log.some((l) => l.text === '熊咆哮了')).toBe(true);
  });
  it('禁言长老：被禁言者不在发言顺序中', () => {
    const roles = ['werewolf', 'werewolf', 'villager', 'villager', 'silencer', 'seer', 'witch', 'hunter'];
    const g = new Sim({ roles, rules: { sheriff: false } });
    g.nights[1] = { silencer: 3 };
    const speakers: number[] = [];
    g.days[1] = { onSpeech: (_sim, seat) => { if (seat != null) speakers.push(seat); } };
    g.toNight(2);
    expect(speakers).not.toContain(3);
    expect(speakers.length).toBe(7);
  });
  it('狼美人出局时被魅惑者殉情', () => {
    const roles = ['werewolf', 'wolfBeauty', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter'];
    const g = new Sim({ roles, rules: { sheriff: false } });
    g.nights[1] = { wolfBeauty: 8 };
    g.days[1] = { votes: 2, shoot: { 8: 1 } };
    g.toNight(2);
    expect(g.dead().sort()).toEqual([2, 8]);
  });
  it('隐狼被预言家验为好人', () => {
    const roles = ['werewolf', 'hiddenWolf', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter'];
    const g = new Sim({ roles, rules: { sheriff: false } });
    g.nights[1] = { seer: 2 };
    g.toDay(1);
    expect(g.info(6).some((t) => t.includes('2号的身份是：好人'))).toBe(true);
  });
  it('血月使徒自爆后当晚封印好人技能', () => {
    const roles = ['werewolf', 'bloodMoon', 'villager', 'villager', 'villager', 'seer', 'witch', 'guard'];
    const g = new Sim({ roles, rules: { sheriff: false } });
    let done = false;
    g.days[1] = { onSpeech: (sim) => { if (!done) { done = true; sim.send({ t: 'dayAction', seat: 2, action: 'explode' }); } } };
    g.nights[2] = { wolves: 3, guard: 3, witch: { save: true } };
    g.toDay(2);
    expect(g.alive(3)).toBe(false);
  });
});
