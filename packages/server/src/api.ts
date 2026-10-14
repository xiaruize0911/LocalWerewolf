import { PRESETS } from '@lw/engine';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from './auth.ts';
import { db } from './db.ts';
import { readFileSync } from 'node:fs';
import { lanAddresses, localHostname } from './lan.ts';
import { voiceCatalog } from '@lw/engine';
import type { RoomManager } from './rooms.ts';
import { bank, voiceFilePath } from './voice.ts';

let preload: string[] | null = null;
const preloadSentences = () => (preload ??= voiceCatalog(20, 4).sentences);

const presetSchema = z.object({
  name: z.string().trim().min(1).max(40),
  playerCount: z.number().int().min(4).max(20),
  board: z.record(z.string(), z.number().int().min(0)),
  rules: z.record(z.string(), z.any()).default({}),
  roleConfig: z.record(z.string(), z.any()).default({}),
});

export function registerApi(app: FastifyInstance, port: number, rooms: RoomManager) {
  app.get('/api/lan', async () => ({ ips: lanAddresses(), hostname: localHostname(), port }));

  // 预生成的语音文件（大屏浏览器播放用）
  app.get('/api/voice/:dir/:sub/:file', async (req, reply) => {
    const { dir, sub, file } = req.params as { dir: string; sub: string; file: string };
    const path = voiceFilePath(dir, sub, file);
    if (!path) return reply.code(404).send({ error: 'not found' });
    reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    return reply.type(file.endsWith('.m4a') ? 'audio/mp4' : 'audio/wav').send(readFileSync(path));
  });

  // 播报设备预加载：本局可能用到的固定句子和单人句子
  app.get('/api/voice-manifest/:code', async (req, reply) => {
    if (!requireUser(req, reply)) return;
    const room = rooms.get(String((req.params as any).code));
    if (!room) return reply.code(404).send({ error: '房间不存在' });
    const rules = room.game?.rules ?? room.config.rules;
    const b = bank(Number(rules.voiceRate) || 190);
    const n = room.config.playerCount;
    const urls: string[] = [];
    for (const s of preloadSentences()) {
      const seats = [...s.matchAll(/(\d+)号/g)].map((m) => Number(m[1]));
      if (seats.length > 1 || seats.some((x) => x > n)) continue;
      if (await b.ready(s)) urls.push((await b.get(s)).url);
    }
    return { urls };
  });

  // ---------------- 板子预设
  app.get('/api/presets', async (req, reply) => {
    const u = requireUser(req, reply);
    if (!u) return;
    const mine = db.prepare('SELECT * FROM presets WHERE owner_id = ? ORDER BY created_at DESC').all(u.id) as any[];
    return {
      builtin: PRESETS,
      mine: mine.map((p) => ({
        id: p.id, name: p.name, playerCount: p.player_count,
        board: JSON.parse(p.board_json), rules: JSON.parse(p.rules_json), roleConfig: JSON.parse(p.role_config_json),
      })),
    };
  });

  app.post('/api/presets', async (req, reply) => {
    const u = requireUser(req, reply);
    if (!u) return;
    const p = presetSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: '板子数据有误' });
    const r = db.prepare('INSERT INTO presets(owner_id, name, player_count, board_json, rules_json, role_config_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(u.id, p.data.name, p.data.playerCount, JSON.stringify(p.data.board), JSON.stringify(p.data.rules), JSON.stringify(p.data.roleConfig), Date.now());
    return { id: Number(r.lastInsertRowid) };
  });

  app.delete('/api/presets/:id', async (req, reply) => {
    const u = requireUser(req, reply);
    if (!u) return;
    db.prepare('DELETE FROM presets WHERE id = ? AND owner_id = ?').run(Number((req.params as any).id), u.id);
    return { ok: true };
  });

  // ---------------- 战绩
  app.get('/api/stats/me', async (req, reply) => {
    const u = requireUser(req, reply);
    if (!u) return;
    const total = db.prepare(`SELECT COUNT(*) AS games, COALESCE(SUM(gp.won), 0) AS wins, COALESCE(SUM(gp.survived), 0) AS survived, COALESCE(SUM(gp.was_sheriff), 0) AS sheriff
      FROM game_players gp JOIN games g ON g.id = gp.game_id WHERE gp.user_id = ? AND g.winner IS NOT NULL AND g.winner != 'aborted'`).get(u.id);
    const byRole = db.prepare(`SELECT gp.initial_role AS role, COUNT(*) AS games, SUM(gp.won) AS wins
      FROM game_players gp JOIN games g ON g.id = gp.game_id WHERE gp.user_id = ? AND g.winner IS NOT NULL AND g.winner != 'aborted'
      GROUP BY gp.initial_role ORDER BY games DESC`).all(u.id);
    const byTeam = db.prepare(`SELECT gp.team AS team, COUNT(*) AS games, SUM(gp.won) AS wins
      FROM game_players gp JOIN games g ON g.id = gp.game_id WHERE gp.user_id = ? AND g.winner IS NOT NULL AND g.winner != 'aborted'
      GROUP BY gp.team`).all(u.id);
    return { total, byRole, byTeam };
  });

  app.get('/api/stats/leaderboard', async (req, reply) => {
    if (!requireUser(req, reply)) return;
    const rows = db.prepare(`SELECT u.id, u.display_name AS name, COUNT(*) AS games, SUM(gp.won) AS wins
      FROM game_players gp JOIN users u ON u.id = gp.user_id JOIN games g ON g.id = gp.game_id
      WHERE g.winner IS NOT NULL AND g.winner != 'aborted'
      GROUP BY u.id ORDER BY wins DESC, games DESC LIMIT 50`).all();
    return { rows };
  });

  app.get('/api/history', async (req, reply) => {
    const u = requireUser(req, reply);
    if (!u) return;
    const rows = db.prepare(`SELECT g.id, g.room_code AS roomCode, g.preset_name AS presetName, g.started_at AS startedAt, g.ended_at AS endedAt,
        g.winner, g.winner_text AS winnerText, g.days, gp.seat, gp.initial_role AS initialRole, gp.final_role AS finalRole, gp.won, gp.survived
      FROM game_players gp JOIN games g ON g.id = gp.game_id WHERE gp.user_id = ? ORDER BY g.started_at DESC LIMIT 200`).all(u.id);
    return { rows };
  });

  app.get('/api/games/:id', async (req, reply) => {
    const u = requireUser(req, reply);
    if (!u) return;
    const id = Number((req.params as any).id);
    const joined = db.prepare('SELECT 1 FROM game_players WHERE game_id = ? AND user_id = ?').get(id, u.id);
    if (!joined && !u.isAdmin) return reply.code(403).send({ error: '只能查看自己参与的对局' });
    const g = db.prepare('SELECT * FROM games WHERE id = ?').get(id) as any;
    if (!g?.ended_at) return reply.code(404).send({ error: '对局尚未结束' });
    const players = db.prepare('SELECT seat, user_id AS userId, name, is_bot AS isBot, initial_role AS initialRole, final_role AS finalRole, team, won, survived, death_day AS deathDay, death_cause AS deathCause, was_sheriff AS wasSheriff FROM game_players WHERE game_id = ? ORDER BY seat').all(id);
    const data = JSON.parse(g.log_json ?? '{}');
    return {
      game: { id: g.id, presetName: g.preset_name, board: JSON.parse(g.board_json), rules: JSON.parse(g.rules_json), startedAt: g.started_at, endedAt: g.ended_at, winner: g.winner, winnerText: g.winner_text, days: g.days },
      players,
      log: data.log ?? [],
      votes: data.votes ?? [],
    };
  });
}
