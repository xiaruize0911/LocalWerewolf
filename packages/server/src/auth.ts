import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { db, type UserRow } from './db.ts';

const SESSION_DAYS = 30;
export const COOKIE = 'lw_sid';

export interface PublicUser {
  id: number;
  username: string;
  displayName: string;
  isAdmin: boolean;
}

export const toPublic = (u: UserRow): PublicUser => ({ id: u.id, username: u.username, displayName: u.display_name, isAdmin: !!u.is_admin });

export function userFromToken(token: string | undefined): PublicUser | null {
  if (!token) return null;
  const row = db
    .prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?')
    .get(token, Date.now()) as UserRow | undefined;
  return row ? toPublic(row) : null;
}

export function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export function currentUser(req: FastifyRequest): PublicUser | null {
  return userFromToken(req.cookies?.[COOKIE]);
}

export function requireUser(req: FastifyRequest, reply: FastifyReply): PublicUser | null {
  const u = currentUser(req);
  if (!u) {
    reply.code(401).send({ error: '请先登录' });
    return null;
  }
  return u;
}

export function requireAdmin(req: FastifyRequest, reply: FastifyReply): PublicUser | null {
  const u = requireUser(req, reply);
  if (!u) return null;
  if (!u.isAdmin) {
    reply.code(403).send({ error: '需要管理员权限' });
    return null;
  }
  return u;
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);

function startSession(reply: FastifyReply, userId: number) {
  const token = randomBytes(32).toString('hex');
  const expires = Date.now() + SESSION_DAYS * 86400_000;
  db.prepare('INSERT INTO sessions(token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires);
  // 局域网是 http，不能设置 Secure
  reply.setCookie(COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: SESSION_DAYS * 86400 });
}

const credSchema = z.object({
  username: z.string().trim().min(2, '用户名至少 2 个字符').max(20, '用户名最多 20 个字符')
    .regex(/^[\w一-龥-]+$/, '用户名只能包含中文、字母、数字、下划线'),
  password: z.string().min(4, '密码至少 4 位').max(100),
});

const registerSchema = credSchema.extend({
  displayName: z.string().trim().max(12, '昵称最多 12 个字符').optional(),
});

function zodMessage(e: z.ZodError) {
  return e.issues[0]?.message ?? '输入有误';
}

export function registerAuthRoutes(app: FastifyInstance) {
  app.post('/api/auth/register', async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: zodMessage(parsed.error) });
    const { username, password, displayName } = parsed.data;
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (exists) return reply.code(409).send({ error: '用户名已被注册' });
    const hash = await bcrypt.hash(password, 10);
    const r = db.prepare('INSERT INTO users(username, password_hash, display_name, created_at) VALUES (?, ?, ?, ?)')
      .run(username, hash, displayName || username, Date.now());
    const id = Number(r.lastInsertRowid);
    startSession(reply, id);
    return { user: toPublic(db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as UserRow) };
  });

  app.post('/api/auth/login', async (req, reply) => {
    const parsed = credSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: zodMessage(parsed.error) });
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(parsed.data.username) as UserRow | undefined;
    if (!row || !(await bcrypt.compare(parsed.data.password, row.password_hash))) {
      return reply.code(401).send({ error: '用户名或密码错误' });
    }
    startSession(reply, row.id);
    return { user: toPublic(row) };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const token = req.cookies?.[COOKIE];
    if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    reply.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/me', async (req, reply) => {
    const u = currentUser(req);
    if (!u) return reply.code(401).send({ error: '未登录' });
    return { user: u };
  });

  app.patch('/api/me', async (req, reply) => {
    const u = requireUser(req, reply);
    if (!u) return;
    const body = z.object({
      displayName: z.string().trim().min(1).max(12).optional(),
      oldPassword: z.string().optional(),
      newPassword: z.string().min(4, '新密码至少 4 位').max(100).optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: zodMessage(body.error) });
    if (body.data.displayName) db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(body.data.displayName, u.id);
    if (body.data.newPassword) {
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(u.id) as unknown as UserRow;
      if (!(await bcrypt.compare(body.data.oldPassword ?? '', row.password_hash))) return reply.code(400).send({ error: '原密码错误' });
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await bcrypt.hash(body.data.newPassword, 10), u.id);
    }
    return { user: toPublic(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id) as unknown as UserRow) };
  });
}
