import type { Command } from '@lw/engine';
import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { COOKIE, parseCookie, userFromToken, type PublicUser } from './auth.ts';
import { RoomError, type Room, type RoomManager } from './rooms.ts';

const cfgSchema = z.object({
  playerCount: z.number().int().min(4).max(20),
  board: z.record(z.string(), z.number().int().min(0).max(20)),
  rules: z.record(z.string(), z.any()).default({}),
  roleConfig: z.record(z.string(), z.record(z.string(), z.any())).default({}),
  presetName: z.string().max(40).default('自定义'),
});

type Ack = (res: any) => void;

export function registerSocket(io: Server, rooms: RoomManager) {
  io.use((socket, next) => {
    const user = userFromToken(parseCookie(socket.handshake.headers.cookie, COOKIE));
    if (!user) return next(new Error('unauthorized'));
    socket.data.user = user;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const user: PublicUser = socket.data.user;

    /** 统一的错误处理：规则错误通过 ack 返回给客户端 */
    const on = (event: string, fn: (data: any, room: Room | undefined) => any) => {
      socket.on(event, (data: any, ack?: Ack) => {
        try {
          const room = socket.data.room ? rooms.get(socket.data.room) : undefined;
          const res = fn(data ?? {}, room);
          ack?.({ ok: true, ...(res ?? {}) });
        } catch (e) {
          const msg = e instanceof RoomError || e instanceof z.ZodError ? (e instanceof z.ZodError ? '参数错误' : e.message) : '服务器错误';
          if (!(e instanceof RoomError) && !(e instanceof z.ZodError)) console.error(`[${event}]`, e);
          ack?.({ ok: false, error: msg });
        }
      });
    };
    const need = (room: Room | undefined) => {
      if (!room) throw new RoomError('你不在房间里');
      return room;
    };
    const needHost = (room: Room | undefined) => {
      const r = need(room);
      if (!r.isHost(user.id) && !user.isAdmin) throw new RoomError('只有房主或管理员可以操作');
      return r;
    };
    const mySeat = (room: Room) => {
      const seat = room.seatOf(user.id);
      if (seat == null) throw new RoomError('你没有座位');
      return seat;
    };

    on('rooms:mine', () => ({ rooms: rooms.mine(user.id) }));

    on('room:create', (data, cur) => {
      const cfg = cfgSchema.parse(data);
      if (cur) cur.leave(socket);
      const room = rooms.create(user, cfg as any);
      room.join(socket, user, false);
      return { code: room.code };
    });

    on('room:join', (data, cur) => {
      const code = String(data.code ?? '');
      const room = rooms.get(code);
      if (!room) throw new RoomError('房间不存在');
      if (cur && cur !== room) cur.leave(socket);
      room.join(socket, user, !!data.display);
      return { code };
    });

    on('room:leave', (_d, room) => room?.leave(socket));
    on('voice:claim', (_d, room) => need(room).claimSpeaker(socket, user));
    on('room:config', (data, room) => needHost(room).setConfig(cfgSchema.parse(data) as any));
    on('seat:take', (data, room) => need(room).takeSeat(user, Number(data.seat)));
    on('seat:leave', (_d, room) => need(room).leaveSeat(user.id));
    on('room:bots', (_d, room) => needHost(room).addBots());
    on('room:kick', (data, room) => needHost(room).kick(Number(data.seat)));
    on('room:reset', (_d, room) => needHost(room).reset());
    on('room:close', (_d, room) => rooms.close(needHost(room).code));
    on('game:start', (_d, room) => needHost(room).start());

    on('game:submit', (data, room) => {
      const r = need(room);
      r.command({ t: 'submit', seat: mySeat(r), promptId: String(data.promptId), payload: data.payload ?? {} }, socket);
    });
    on('game:speechEnd', (_d, room) => {
      const r = need(room);
      r.command({ t: 'speechEnd', seat: mySeat(r) }, socket);
    });
    on('game:dayAction', (data, room) => {
      const r = need(room);
      const action = z.enum(['explode', 'duel', 'withdraw']).parse(data.action);
      r.command({ t: 'dayAction', seat: mySeat(r), action, target: data.target == null ? undefined : Number(data.target) }, socket);
    });
    on('game:host', (data, room) => {
      const action = z.enum(['pause', 'resume', 'nextSpeaker', 'skipAllSpeech', 'startVote', 'advance', 'abort']).parse(data.action);
      needHost(room).command({ t: 'host', action } as Command, socket);
    });
    on('game:announceDone', (data, room) => {
      const r = need(room);
      if (r.game?.announce?.id === data.id) r.command({ t: 'announceDone', id: String(data.id) });
    });
    on('time:ping', () => ({ now: Date.now() }));

    socket.on('disconnect', () => {
      const room = socket.data.room ? rooms.get(socket.data.room) : undefined;
      room?.leave(socket);
    });
  });
}
