// 管理员账号命令行工具：npm run admin -- <命令> [用户名]
//   init                没有管理员时创建 admin（随机密码写入 data/admin-password.txt）
//   list                列出管理员
//   create <用户名>     创建管理员（交互输入密码）
//   grant <用户名>      把已有用户设为管理员
//   revoke <用户名>     取消管理员
//   passwd <用户名>     重置密码（交互输入）
import { createInterface } from 'node:readline';
import { ADMIN_PASSWORD_FILE, ensureAdmin } from '../packages/server/src/admin.ts';
import { hashPassword } from '../packages/server/src/auth.ts';
import { db } from '../packages/server/src/db.ts';

const [cmd, username] = process.argv.slice(2);

function askHidden(q: string): Promise<string> {
  return new Promise((res) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = rl as any;
    out._writeToOutput = (s: string) => out.output.write(s.includes(q) ? s : '');
    rl.question(q, (a) => {
      rl.close();
      process.stdout.write('\n');
      res(a);
    });
  });
}

async function askPassword(): Promise<string> {
  const a = await askHidden('输入密码：');
  const b = await askHidden('再次输入：');
  if (a !== b) throw new Error('两次输入不一致');
  if (a.length < 4) throw new Error('密码至少 4 位');
  return a;
}

const find = (u: string) => db.prepare('SELECT id, is_admin FROM users WHERE username = ?').get(u) as { id: number; is_admin: number } | undefined;

try {
  switch (cmd) {
    case 'init': {
      const r = await ensureAdmin();
      if (!r) console.log('已经有管理员了（npm run admin -- list 查看）');
      else if (r.created) console.log(`已创建管理员 admin，初始密码保存在 ${ADMIN_PASSWORD_FILE}`);
      else console.log('已把现有用户 admin 设为管理员');
      break;
    }
    case 'list': {
      const rows = db.prepare('SELECT username, display_name FROM users WHERE is_admin = 1').all() as any[];
      console.log(rows.length ? rows.map((r) => `${r.username}（${r.display_name}）`).join('\n') : '没有管理员');
      break;
    }
    case 'create': {
      if (!username) throw new Error('用法：npm run admin -- create <用户名>');
      if (find(username)) throw new Error('用户名已存在，可以用 grant 设为管理员');
      const pw = await askPassword();
      db.prepare('INSERT INTO users(username, password_hash, display_name, created_at, is_admin) VALUES (?, ?, ?, ?, 1)').run(username, await hashPassword(pw), username, Date.now());
      console.log(`已创建管理员 ${username}`);
      break;
    }
    case 'grant':
    case 'revoke': {
      const u = username && find(username);
      if (!u) throw new Error('用户不存在');
      db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(cmd === 'grant' ? 1 : 0, u.id);
      console.log(cmd === 'grant' ? `${username} 已成为管理员` : `已取消 ${username} 的管理员权限`);
      break;
    }
    case 'passwd': {
      const u = username && find(username);
      if (!u) throw new Error('用户不存在');
      const pw = await askPassword();
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(pw), u.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
      console.log(`已重置 ${username} 的密码`);
      break;
    }
    default:
      console.log('用法：npm run admin -- <init|list|create|grant|revoke|passwd> [用户名]');
  }
} catch (e: any) {
  console.error(e.message);
  process.exitCode = 1;
}
