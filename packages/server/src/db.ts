import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = resolve(process.env.LW_DATA_DIR ?? resolve(here, '../../../data'));
mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(process.env.LW_DB ?? resolve(DATA_DIR, 'werewolf.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions(
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS presets(
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  player_count INTEGER NOT NULL,
  board_json TEXT NOT NULL,
  rules_json TEXT NOT NULL,
  role_config_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS games(
  id INTEGER PRIMARY KEY,
  room_code TEXT NOT NULL,
  preset_name TEXT,
  board_json TEXT NOT NULL,
  rules_json TEXT NOT NULL,
  seed TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  winner TEXT,
  winner_text TEXT,
  days INTEGER,
  log_json TEXT
);
CREATE TABLE IF NOT EXISTS game_players(
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  seat INTEGER NOT NULL,
  user_id INTEGER,
  name TEXT NOT NULL,
  is_bot INTEGER NOT NULL DEFAULT 0,
  initial_role TEXT NOT NULL,
  final_role TEXT NOT NULL,
  team TEXT NOT NULL,
  won INTEGER NOT NULL,
  survived INTEGER NOT NULL,
  death_day INTEGER,
  death_cause TEXT,
  was_sheriff INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(game_id, seat)
);
CREATE INDEX IF NOT EXISTS idx_gp_user ON game_players(user_id);
CREATE TABLE IF NOT EXISTS room_snapshots(
  code TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`);

// 迁移：管理员标记
const userCols = (db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map((c) => c.name);
if (!userCols.includes('is_admin')) db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  display_name: string;
  created_at: number;
  is_admin: number;
}
