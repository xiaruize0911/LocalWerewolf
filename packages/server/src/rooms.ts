import {
  createGame, dispatch, nextTimer, normalizeRules, playerResults, project, validateBoard,
  type Board, type Command, type Effect, type GameState, type Rules, type Seat,
} from '@lw/engine';
import { randomBytes } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import { botPayload, fallbackPayload } from './bots.ts';
import { db } from './db.ts';
import { bank, SayQueue, serverVoiceAvailable } from './voice.ts';
import type { PublicUser } from './auth.ts';

export interface SeatInfo {
  userId: number | string | null;
  name: string;
  bot?: boolean;
}

export interface RoomConfig {
  playerCount: number;
  board: Board;
  rules: Rules;
  roleConfig: Record<string, Record<string, any>>;
  presetName: string;
}

interface Member {
  socket: Socket;
  userId: number;
  isAdmin: boolean;
  display: boolean;
}

export class RoomError extends Error {}

export class Room {
  game: GameState | null = null;
  gameId: number | null = null;
  updatedAt = Date.now();
  members = new Map<string, Member>();
  private timer: NodeJS.Timeout | null = null;
  private say = new SayQueue();
  private botPending = new Set<string>();
  private snapTimer: NodeJS.Timeout | null = null;
  private announceChain: Promise<void> = Promise.resolve();
  /** 负责播放语音的 socket（房主设备） */
  private speaker: string | null = null;

  constructor(
    private io: Server,
    public code: string,
    public hostId: number,
    public hostName: string,
    public config: RoomConfig,
    public seats: SeatInfo[],
    public createdAt = Date.now(),
  ) {}

  // ------------------------------------------------------------ 成员

  join(socket: Socket, user: PublicUser, display: boolean) {
    this.members.set(socket.id, { socket, userId: user.id, isAdmin: user.isAdmin, display });
    socket.join(`room:${this.code}`);
    socket.data.room = this.code;
    if (user.id === this.hostId) this.changed();
    else this.sendTo(this.members.get(socket.id)!);
  }

  leave(socket: Socket) {
    const wasSpeaker = this.speakerId() === socket.id;
    this.members.delete(socket.id);
    if (this.speaker === socket.id) this.speaker = null;
    if (wasSpeaker) this.changed();
    socket.leave(`room:${this.code}`);
    if (socket.data.room === this.code) socket.data.room = null;
  }

  /**
   * 当前的播报设备：房主（或管理员）手动指定的设备优先；
   * 否则用房主打开的大屏页面；再否则用房主最近连上的设备。
   */
  speakerId(): string | null {
    if (this.speaker && this.members.has(this.speaker)) return this.speaker;
    const host = [...this.members.values()].filter((m) => m.userId === this.hostId);
    return host.filter((m) => m.display).at(-1)?.socket.id ?? host.at(-1)?.socket.id ?? null;
  }

  claimSpeaker(socket: Socket, user: PublicUser) {
    if (!this.isHost(user.id) && !user.isAdmin) throw new RoomError('只有房主可以设置播报设备');
    if (!this.members.has(socket.id)) throw new RoomError('你不在房间里');
    this.speaker = socket.id;
    this.changed();
  }

  voiceMode(): 'host' | 'server' {
    const rules = this.game?.rules ?? this.config.rules;
    return rules.voiceMode === 'server' && serverVoiceAvailable() ? 'server' : 'host';
  }

  seatOf(userId: number | string): Seat | null {
    const i = this.seats.findIndex((s) => s.userId === userId);
    return i < 0 ? null : i + 1;
  }

  isHost(userId: number) {
    return userId === this.hostId;
  }

  // ------------------------------------------------------------ 大厅

  private assertLobby() {
    if (this.game && this.game.phase !== 'over') throw new RoomError('游戏进行中');
  }

  setConfig(cfg: RoomConfig) {
    this.assertLobby();
    if (this.game) this.game = null;
    const n = Math.max(4, Math.min(20, Math.floor(cfg.playerCount)));
    this.config = { ...cfg, playerCount: n, rules: normalizeRules(cfg.rules) };
    if (this.seats.length > n) this.seats = this.seats.slice(0, n);
    while (this.seats.length < n) this.seats.push({ userId: null, name: '' });
    this.changed();
  }

  takeSeat(user: PublicUser, seat: Seat) {
    this.assertLobby();
    if (this.game) this.game = null;
    const i = seat - 1;
    if (i < 0 || i >= this.seats.length) throw new RoomError('座位不存在');
    const cur = this.seats[i];
    if (cur.userId != null && cur.userId !== user.id) throw new RoomError('该座位已有人');
    for (const s of this.seats) if (s.userId === user.id) Object.assign(s, { userId: null, name: '', bot: false });
    this.seats[i] = { userId: user.id, name: user.displayName };
    this.changed();
  }

  leaveSeat(userId: number) {
    this.assertLobby();
    for (const s of this.seats) if (s.userId === userId) Object.assign(s, { userId: null, name: '', bot: false });
    this.changed();
  }

  addBots() {
    this.assertLobby();
    this.seats.forEach((s, i) => {
      if (s.userId == null) this.seats[i] = { userId: `bot-${i + 1}`, name: `机器人${i + 1}`, bot: true };
    });
    this.changed();
  }

  kick(seat: Seat) {
    this.assertLobby();
    const s = this.seats[seat - 1];
    if (s) Object.assign(s, { userId: null, name: '', bot: false });
    this.changed();
  }

  start() {
    this.assertLobby();
    if (this.seats.some((s) => s.userId == null)) throw new RoomError('还有空座位');
    const err = validateBoard(this.config.board, this.config.playerCount);
    if (err) throw new RoomError(err);
    const seed = randomBytes(16).toString('hex');
    const now = Date.now();
    const { state, effects } = createGame({
      id: `${this.code}-${now}`,
      players: this.seats.map((s, i) => ({ seat: i + 1, userId: s.userId!, name: s.name, isBot: !!s.bot })),
      board: this.config.board,
      rules: this.config.rules,
      roleConfig: this.config.roleConfig,
      seed,
      now,
    });
    this.game = state;
    const r = db.prepare('INSERT INTO games(room_code, preset_name, board_json, rules_json, seed, started_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(this.code, this.config.presetName, JSON.stringify(this.config.board), JSON.stringify(state.rules), seed, now);
    this.gameId = Number(r.lastInsertRowid);
    this.say.stop();
    this.handleEffects(effects);
    this.changed();
  }

  /** 游戏结束后回到大厅（保留座位） */
  reset() {
    if (this.game && this.game.phase !== 'over') throw new RoomError('游戏进行中');
    this.game = null;
    this.gameId = null;
    this.changed();
  }

  // ------------------------------------------------------------ 游戏

  command(cmd: Command, from?: Socket) {
    if (!this.game) throw new RoomError('游戏尚未开始');
    const r = dispatch(this.game, cmd, Date.now());
    this.game = r.state;
    this.handleEffects(r.effects, from);
    this.changed();
  }

  private handleEffects(effects: Effect[], from?: Socket) {
    for (const e of effects) {
      if (e.t === 'announce') this.announce(e.id, e.text);
      else if (e.t === 'error') {
        if (from) from.emit('toast', { type: 'error', text: e.message });
        else throw new RoomError(e.message);
      } else if (e.t === 'over') this.persistResult();
    }
  }

  private announce(id: string, text: string) {
    const rules = this.game?.rules ?? this.config.rules;
    const rate = Number(rules.voiceRate) || 190;
    if (this.voiceMode() === 'host') {
      // 房主设备播放：按顺序取得预生成的音频文件，只让播报设备播放并回报播放完毕
      this.announceChain = this.announceChain.then(async () => {
        const file = serverVoiceAvailable() ? await bank(rate).get(text).catch(() => null) : null;
        const speaker = this.speakerId();
        for (const m of this.members.values()) {
          m.socket.emit('announce', { id, text, audio: file?.url ?? null, play: m.socket.id === speaker });
        }
      });
      return;
    }
    this.io.to(`room:${this.code}`).emit('announce', { id, text, audio: null, play: false });
    this.say.speak(text, rate, () => {
      if (this.game?.announce?.id === id) {
        try {
          this.command({ t: 'announceDone', id });
        } catch {
          /* 游戏可能已结束 */
        }
      }
    });
  }

  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.game) return;
    const t = nextTimer(this.game);
    if (t == null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        this.command({ t: 'tick' });
      } catch (e) {
        console.error('[tick]', e);
      }
    }, Math.max(0, t - Date.now()) + 5);
  }

  private runBots() {
    const g = this.game;
    if (!g || g.phase === 'over' || g.paused) return;
    const botSeats = new Set(g.players.filter((p) => p.isBot).map((p) => p.seat));
    if (!botSeats.size) return;
    for (const p of g.prompts) {
      if (p.closed) continue;
      for (const seat of p.seats) {
        if (!botSeats.has(seat)) continue;
        const responded = p.responses[seat];
        // 狼队：机器人跟随真人队友的最新选择
        let follow: any = null;
        if (p.group && responded) {
          const human = p.seats.find((s) => !botSeats.has(s) && p.responses[s]);
          if (human && JSON.stringify(p.responses[human]) !== JSON.stringify(responded)) follow = p.responses[human];
        }
        if (responded && !follow) continue;
        const key = `${p.id}:${seat}:${follow ? JSON.stringify(follow) : ''}`;
        if (this.botPending.has(key)) continue;
        this.botPending.add(key);
        setTimeout(() => {
          this.botPending.delete(key);
          const cur = this.game;
          if (!cur || cur.prompts.every((x) => x.id !== p.id)) return;
          const view = project(cur, seat);
          if (!view.prompt || view.prompt.closed) return;
          const payload = follow ?? botPayload(view);
          const r = dispatch(cur, { t: 'submit', seat, promptId: p.id, payload }, Date.now());
          const failed = r.effects.some((e) => e.t === 'error');
          try {
            this.command({ t: 'submit', seat, promptId: p.id, payload: failed ? fallbackPayload(view.prompt.spec) : payload });
          } catch {
            /* 已结束 */
          }
        }, 600 + Math.random() * 1600);
      }
    }
    const cur = g.current;
    if (cur?.kind === 'speech' && botSeats.has(cur.seat)) {
      const key = `speech:${g.seq}:${cur.seat}`;
      if (!this.botPending.has(key)) {
        this.botPending.add(key);
        setTimeout(() => {
          this.botPending.delete(key);
          if (this.game?.current?.kind === 'speech' && this.game.current.seat === cur.seat) {
            try {
              this.command({ t: 'speechEnd', seat: cur.seat });
            } catch {
              /* ignore */
            }
          }
        }, 1500);
      }
    }
  }

  private persistResult() {
    const g = this.game;
    if (!g || this.gameId == null) return;
    const results = new Map(playerResults(g).map((r) => [r.seat, r]));
    db.prepare('UPDATE games SET ended_at = ?, winner = ?, winner_text = ?, days = ?, log_json = ? WHERE id = ?')
      .run(Date.now(), g.winner?.faction ?? null, g.winner?.text ?? null, g.day, JSON.stringify({ log: g.log, votes: g.votes }), this.gameId);
    const ins = db.prepare(`INSERT OR REPLACE INTO game_players(game_id, seat, user_id, name, is_bot, initial_role, final_role, team, won, survived, death_day, death_cause, was_sheriff)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const sheriffs = new Set<number>();
    for (const l of g.log) {
      const m = /(\d+)号当选警长|警徽移交给(\d+)号/.exec(l.text);
      if (m) sheriffs.add(Number(m[1] ?? m[2]));
    }
    for (const p of g.players) {
      const r = results.get(p.seat)!;
      ins.run(this.gameId, p.seat, typeof p.userId === 'number' ? p.userId : null, p.name, p.isBot ? 1 : 0, p.initialRole, p.role,
        r.team, r.won ? 1 : 0, p.alive ? 1 : 0, p.deathDay ?? null, p.deathCause ?? null, sheriffs.has(p.seat) ? 1 : 0);
    }
  }

  // ------------------------------------------------------------ 广播

  lobbyState() {
    return {
      code: this.code,
      hostId: this.hostId,
      hostName: this.hostName,
      config: this.config,
      seats: this.seats.map((s, i) => ({ seat: i + 1, userId: s.userId, name: s.name, bot: !!s.bot })),
      started: !!this.game,
      over: this.game?.phase === 'over',
      gameId: this.gameId,
      serverVoice: serverVoiceAvailable(),
      voiceMode: this.voiceMode(),
      speaker: (() => {
        const id = this.speakerId();
        const m = id ? this.members.get(id) : null;
        return m ? { socketId: m.socket.id, display: m.display } : null;
      })(),
    };
  }

  private sendTo(m: Member) {
    m.socket.emit('room:state', this.lobbyState());
    if (this.game) {
      const seat = m.display ? null : this.seatOf(m.userId);
      m.socket.emit('game:view', { view: project(this.game, seat), seat, display: m.display, isHost: this.isHost(m.userId) || m.isAdmin });
    } else {
      m.socket.emit('game:view', null);
    }
  }

  changed() {
    this.updatedAt = Date.now();
    this.schedule();
    for (const m of this.members.values()) this.sendTo(m);
    this.runBots();
    this.saveSnapshot();
  }

  private saveSnapshot() {
    if (this.snapTimer) return;
    this.snapTimer = setTimeout(() => {
      this.snapTimer = null;
      db.prepare('INSERT OR REPLACE INTO room_snapshots(code, data, updated_at) VALUES (?, ?, ?)').run(this.code, JSON.stringify(this.toJSON()), Date.now());
    }, 300);
  }

  toJSON() {
    return {
      code: this.code, hostId: this.hostId, hostName: this.hostName, config: this.config, seats: this.seats,
      game: this.game, gameId: this.gameId, createdAt: this.createdAt, updatedAt: this.updatedAt,
    };
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
    this.say.stop();
    db.prepare('DELETE FROM room_snapshots WHERE code = ?').run(this.code);
  }
}

export class RoomManager {
  rooms = new Map<string, Room>();

  constructor(private io: Server) {
    this.restore();
    setInterval(() => this.cleanup(), 10 * 60_000).unref();
  }

  private restore() {
    const rows = db.prepare('SELECT data FROM room_snapshots').all() as { data: string }[];
    for (const { data } of rows) {
      try {
        const d = JSON.parse(data);
        if (Date.now() - d.updatedAt > 24 * 3600_000) continue;
        const room = new Room(this.io, d.code, d.hostId, d.hostName, d.config, d.seats, d.createdAt);
        room.game = d.game;
        room.gameId = d.gameId;
        this.rooms.set(d.code, room);
        room.changed();
      } catch (e) {
        console.error('恢复房间失败', e);
      }
    }
    if (this.rooms.size) console.log(`已恢复 ${this.rooms.size} 个房间`);
  }

  private cleanup() {
    for (const [code, r] of this.rooms) {
      if (!r.members.size && Date.now() - r.updatedAt > 12 * 3600_000) this.close(code);
    }
  }

  create(user: PublicUser, cfg: RoomConfig): Room {
    let code: string;
    do code = String(1000 + Math.floor(Math.random() * 9000));
    while (this.rooms.has(code));
    const room = new Room(this.io, code, user.id, user.displayName, cfg, []);
    this.rooms.set(code, room);
    room.setConfig(cfg);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  close(code: string) {
    const r = this.rooms.get(code);
    if (!r) return;
    this.io.to(`room:${code}`).emit('room:closed');
    for (const m of r.members.values()) r.leave(m.socket);
    r.dispose();
    this.rooms.delete(code);
  }

  /** 用户相关的房间（房主或在座） */
  mine(userId: number) {
    return [...this.rooms.values()]
      .filter((r) => r.hostId === userId || r.seatOf(userId) != null)
      .map((r) => ({ code: r.code, hostName: r.hostName, presetName: r.config.presetName, started: !!r.game, over: r.game?.phase === 'over', seat: r.seatOf(userId), isHost: r.hostId === userId }));
  }
}
