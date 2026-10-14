import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { ADMIN_PASSWORD_FILE, ensureAdmin, registerAdminRoutes } from './admin.ts';
import { registerApi } from './api.ts';
import { registerAuthRoutes } from './auth.ts';
import { lanAddresses, localHostname } from './lan.ts';
import { RoomManager } from './rooms.ts';
import { registerSocket } from './socket.ts';
import { defaultRules } from '@lw/engine';
import { bank, detectVoice, serverVoiceAvailable } from './voice.ts';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';
const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '../../client/dist');

const app = Fastify({ logger: false, trustProxy: true });
await app.register(cookie);
registerAuthRoutes(app);

const prod = existsSync(resolve(dist, 'index.html'));
if (prod) {
  await app.register(fastifyStatic, { root: dist, wildcard: false });
  // 单页应用：非 API 路径都返回 index.html
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/') || req.url.startsWith('/socket.io')) return reply.code(404).send({ error: 'not found' });
    return reply.sendFile('index.html');
  });
}

const io = new Server(app.server, { cors: { origin: true, credentials: true } });
const rooms = new RoomManager(io);
registerApi(app, PORT, rooms);
registerSocket(io, rooms);
registerAdminRoutes(app, rooms);
const adminInit = await ensureAdmin();

await app.listen({ port: PORT, host: HOST });

const ips = lanAddresses();
const webPort = prod ? PORT : 5173;
console.log('\n🐺 狼人杀自动法官已启动');
if (!prod) console.log(`   （开发模式：API 端口 ${PORT}，网页由 Vite 在 ${webPort} 端口提供）`);
console.log(`   本机访问：  http://localhost:${webPort}`);
for (const ip of ips) console.log(`   局域网访问：http://${ip}:${webPort}`);
console.log(`   或：        http://${localHostname()}:${webPort}`);
console.log('   首次运行时如果 macOS 弹出防火墙提示，请选择「允许」。');
if (adminInit?.created) console.log(`   已创建管理员账号 admin，初始密码保存在 ${ADMIN_PASSWORD_FILE}`);
else if (adminInit) console.log('   已把现有用户 admin 设为管理员');
console.log('');

// 后台预生成全部语音（已经生成过的会跳过），之后每次播报都直接使用缓存文件
if (serverVoiceAvailable() && process.env.LW_NO_PREGEN !== '1') {
  void (async () => {
    const voice = await detectVoice();
    const t0 = Date.now();
    let last = 0;
    const r = await bank(Number(defaultRules().voiceRate)).pregenerateAll((done, total) => {
      if (done === total || done - last >= 200) {
        last = done;
        console.log(`   语音预生成（${voice ?? '系统默认语音'}）：${done}/${total}`);
      }
    });
    if (r) console.log(`   全部 ${r.sentences} 句语音已就绪（本次生成 ${r.generated} 个文件，用时 ${((Date.now() - t0) / 1000).toFixed(0)} 秒）`);
  })().catch((e) => console.error('语音预生成失败', e));
}
