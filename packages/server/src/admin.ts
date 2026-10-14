import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hashPassword, requireAdmin } from './auth.ts';
import { DATA_DIR, db } from './db.ts';
import type { RoomManager } from './rooms.ts';

export const ADMIN_PASSWORD_FILE = resolve(DATA_DIR, 'admin-password.txt');

const adminCount = () => (db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1').get() as { n: number }).n;

/**
 * 没有任何管理员时，创建 admin 账号（随机密码写入 data/admin-password.txt，不打印到日志）。
 * 如果 admin 用户名已被普通用户占用，则把它提升为管理员。
 */
export async function ensureAdmin(): Promise<{ created: boolean; username: string } | null> {
  if (adminCount() > 0) return null;
  const existing = db.prepare("SELECT id FROM users WHERE username = 'admin'").get() as { id: number } | undefined;
  if (existing) {
    db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(existing.id);
    return { created: false, username: 'admin' };
  }
  const password = randomBytes(9).toString('base64url');
  db.prepare("INSERT INTO users(username, password_hash, display_name, created_at, is_admin) VALUES ('admin', ?, '管理员', ?, 1)")
    .run(await hashPassword(password), Date.now());
  writeFileSync(ADMIN_PASSWORD_FILE, `用户名：admin\n初始密码：${password}\n登录后请在「账号设置」中修改密码，然后删除本文件。\n`, { mode: 0o600 });
  return { created: true, username: 'admin' };
}

export function registerAdminRoutes(app: FastifyInstance, rooms: RoomManager) {
  // ---------------- 用户
  app.get('/api/admin/users', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const rows = db.prepare(`SELECT u.id, u.username, u.display_name AS displayName, u.created_at AS createdAt, u.is_admin AS isAdmin,
        (SELECT COUNT(*) FROM game_players gp JOIN games g ON g.id = gp.game_id WHERE gp.user_id = u.id AND g.ended_at IS NOT NULL) AS games,
        (SELECT COALESCE(SUM(gp.won), 0) FROM game_players gp WHERE gp.user_id = u.id) AS wins,
        (SELECT MAX(expires_at) FROM sessions s WHERE s.user_id = u.id) AS lastSession
      FROM users u ORDER BY u.created_at DESC`).all();
    return { users: rows };
  });

  app.patch('/api/admin/users/:id', async (req, reply) => {
    const me = requireAdmin(req, reply);
    if (!me) return;
    const id = Number((req.params as any).id);
    const body = z.object({
      isAdmin: z.boolean().optional(),
      displayName: z.string().trim().min(1).max(12).optional(),
      password: z.string().min(4, '密码至少 4 位').max(100).optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? '参数错误' });
    const target = db.prepare('SELECT id, is_admin FROM users WHERE id = ?').get(id) as { id: number; is_admin: number } | undefined;
    if (!target) return reply.code(404).send({ error: '用户不存在' });
    if (body.data.isAdmin === false && target.is_admin && adminCount() <= 1) return reply.code(400).send({ error: '至少需要保留一名管理员' });
    if (body.data.isAdmin !== undefined) db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(body.data.isAdmin ? 1 : 0, id);
    if (body.data.displayName) db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(body.data.displayName, id);
    if (body.data.password) {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(body.data.password), id);
      // 重置密码后让该用户在其他设备上重新登录
      if (id !== me.id) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    }
    return { ok: true };
  });

  app.delete('/api/admin/users/:id', async (req, reply) => {
    const me = requireAdmin(req, reply);
    if (!me) return;
    const id = Number((req.params as any).id);
    if (id === me.id) return reply.code(400).send({ error: '不能删除自己' });
    // 保留历史对局记录，只解除关联
    db.prepare('UPDATE game_players SET user_id = NULL WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return { ok: true };
  });

  // ---------------- 房间
  app.get('/api/admin/rooms', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    return {
      rooms: [...rooms.rooms.values()].map((r) => ({
        code: r.code,
        hostName: r.hostName,
        presetName: r.config.presetName,
        playerCount: r.config.playerCount,
        seated: r.seats.filter((s) => s.userId != null).length,
        bots: r.seats.filter((s) => s.bot).length,
        online: r.members.size,
        status: !r.game ? '等待中' : r.game.phase === 'over' ? '已结束' : `进行中 · ${r.game.stage}`,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })).sort((a, b) => b.updatedAt - a.updatedAt),
    };
  });

  app.post('/api/admin/rooms/:code/close', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    rooms.close(String((req.params as any).code));
    return { ok: true };
  });

  // ---------------- 对局
  app.get('/api/admin/games', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const rows = db.prepare(`SELECT g.id, g.room_code AS roomCode, g.preset_name AS presetName, g.started_at AS startedAt, g.ended_at AS endedAt,
        g.winner, g.winner_text AS winnerText, g.days,
        (SELECT GROUP_CONCAT(name, '、') FROM game_players gp WHERE gp.game_id = g.id AND gp.is_bot = 0) AS players
      FROM games g ORDER BY g.started_at DESC LIMIT 500`).all();
    return { games: rows };
  });

  app.delete('/api/admin/games/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const id = Number((req.params as any).id);
    db.prepare('DELETE FROM game_players WHERE game_id = ?').run(id);
    db.prepare('DELETE FROM games WHERE id = ?').run(id);
    return { ok: true };
  });

  app.get('/api/admin/summary', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const one = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
    return {
      users: one('SELECT COUNT(*) AS n FROM users'),
      games: one('SELECT COUNT(*) AS n FROM games WHERE ended_at IS NOT NULL'),
      rooms: rooms.rooms.size,
      online: [...rooms.rooms.values()].reduce((a, r) => a + r.members.size, 0),
    };
  });
}
