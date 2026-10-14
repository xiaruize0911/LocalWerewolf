import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { voiceCatalog } from '@lw/engine';
import { DATA_DIR } from './db.ts';

/**
 * 预生成语音（服务器只负责生成文件，播放在房主设备的浏览器里，或可选在服务器上）：
 *  - 所有可能出现的播报句子整句渲染（含 1~20 号的所有单人、双人组合），保存为 AAC（.m4a）
 *  - 三人及以上的名单（如「昨晚3号、5号、7号玩家死亡」）由预先渲染的片段拼接成 .wav
 *  - 缓存目录：data/voice/<语音>-<语速>/{full,clips,mix}
 */

const SAMPLE_RATE = 22050;
const GAP_MS = 70;
const PAUSE_MS = 220;
const MAX_SEATS = 20;

export const serverVoiceAvailable = () => process.platform === 'darwin';

let voiceName: Promise<string | null> | null = null;

/** 选择一个中文语音（Tingting 优先）。`say -v '?'` 的名字可能带括号，只取第一个词 */
export function detectVoice(): Promise<string | null> {
  if (voiceName) return voiceName;
  voiceName = new Promise((res) => {
    if (!serverVoiceAvailable()) return res(null);
    execFile('say', ['-v', '?'], (err, stdout) => {
      if (err) return res(null);
      const entries = stdout.split('\n').map((l) => {
        const m = /^(.+?)\s+([a-z]{2}_[A-Z]{2})\s+#/.exec(l);
        return m ? { full: m[1].trim(), short: m[1].split(' (')[0].trim(), lang: m[2] } : null;
      }).filter((x): x is { full: string; short: string; lang: string } => !!x);
      const want = process.env.LW_VOICE;
      const pick = (want && entries.find((e) => e.short === want || e.full === want))
        || entries.find((e) => e.short === 'Tingting' && e.lang === 'zh_CN')
        || entries.find((e) => e.lang === 'zh_CN')
        || entries.find((e) => e.lang.startsWith('zh'));
      res(pick ? pick.short : null);
    });
  });
  return voiceName;
}

const sha = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 20);
/** 执行命令；macOS 的 say 偶尔会卡住不退出，所以加超时并重试 */
async function run(cmd: string, args: string[], timeout = 20_000, tries = 3): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      await new Promise<void>((res, rej) => execFile(cmd, args, { timeout, killSignal: 'SIGKILL' }, (err) => (err ? rej(err) : res())));
      return;
    } catch (e) {
      if (i >= tries) throw e;
    }
  }
}

/** 名单里的座位数（3 人及以上需要拼接） */
function listLength(text: string): number {
  return Math.max(0, ...[...text.matchAll(/\d+号(?:、\d+号)+/g)].map((m) => m[0].split('、').length));
}

// ---------------------------------------------------------------- WAV 拼接

function readPcm(file: string): Int16Array {
  const buf = readFileSync(file);
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'data') {
      const data = buf.subarray(off + 8, off + 8 + size);
      return new Int16Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.length - (data.length % 2)));
    }
    off += 8 + size + (size % 2);
  }
  return new Int16Array(0);
}

function trim(pcm: Int16Array): Int16Array {
  const th = 300;
  let a = 0;
  let b = pcm.length - 1;
  while (a < pcm.length && Math.abs(pcm[a]) < th) a++;
  while (b > a && Math.abs(pcm[b]) < th) b--;
  const pad = Math.round(SAMPLE_RATE * 0.03);
  return pcm.subarray(Math.max(0, a - pad), Math.min(pcm.length, b + pad));
}

function wav(pcm: Int16Array): Buffer {
  const data = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SAMPLE_RATE, 24);
  h.writeUInt32LE(SAMPLE_RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const silence = (ms: number) => new Int16Array(Math.round((SAMPLE_RATE * ms) / 1000));

/** 拼接用的片段：数字（含「号」）单独成段，标点变成停顿 */
export function segments(text: string): (string | { pause: number })[] {
  const out: (string | { pause: number })[] = [];
  for (const part of text.split(/(\d+号?)/)) {
    if (!part) continue;
    if (/^\d/.test(part)) {
      out.push(part);
      continue;
    }
    for (const piece of part.split(/([，、。；：！？,])/)) {
      if (!piece) continue;
      if (/^[，、。；：！？,]$/.test(piece)) out.push({ pause: PAUSE_MS });
      else out.push(piece);
    }
  }
  return out;
}

// ---------------------------------------------------------------- 语音库

export interface VoiceFile {
  /** 磁盘路径 */
  path: string;
  /** 浏览器下载地址 */
  url: string;
}

export class VoiceBank {
  private jobs = new Map<string, Promise<VoiceFile>>();
  private clips = new Map<string, Promise<Int16Array>>();
  private dirName: Promise<string>;

  constructor(private rate: number) {
    this.dirName = detectVoice().then((v) => {
      const name = `${v ?? 'default'}-${rate}`;
      for (const sub of ['full', 'clips', 'mix', 'tmp']) mkdirSync(resolve(DATA_DIR, 'voice', name, sub), { recursive: true });
      return name;
    });
  }

  private async path(sub: string, file: string) {
    return resolve(DATA_DIR, 'voice', await this.dirName, sub, file);
  }

  private async toFile(path: string): Promise<VoiceFile> {
    const sub = basename(resolve(path, '..'));
    return { path, url: `/api/voice/${await this.dirName}/${sub}/${basename(path)}` };
  }

  private async sayArgs(text: string, out: string, extra: string[] = []) {
    const voice = await detectVoice();
    return [...(voice ? ['-v', voice] : []), '-r', String(this.rate), '-o', out, ...extra, text];
  }

  /** 整句渲染为 AAC */
  private async renderWhole(text: string): Promise<VoiceFile> {
    const out = await this.path('full', `${sha(text)}.m4a`);
    if (!existsSync(out)) {
      const tmp = await this.path('tmp', `${sha(text)}-${process.pid}-${Math.random().toString(36).slice(2)}.aiff`);
      try {
        await run('say', await this.sayArgs(text, tmp));
        await run('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '32000', tmp, `${out}.part`]);
        renameSync(`${out}.part`, out);
      } finally {
        if (existsSync(tmp)) unlinkSync(tmp);
      }
    }
    return this.toFile(out);
  }

  /** 拼接用片段（WAV） */
  private clip(text: string): Promise<Int16Array> {
    const hit = this.clips.get(text);
    if (hit) return hit;
    const p = (async () => {
      const file = await this.path('clips', `${sha(text)}.wav`);
      if (!existsSync(file)) await run('say', await this.sayArgs(text, file, ['--data-format=LEI16@22050']));
      return trim(readPcm(file));
    })();
    this.clips.set(text, p);
    p.catch(() => this.clips.delete(text));
    return p;
  }

  private async stitch(text: string): Promise<VoiceFile> {
    const out = await this.path('mix', `${sha(text)}.wav`);
    if (!existsSync(out)) {
      const parts: Int16Array[] = [];
      for (const seg of segments(text)) {
        if (typeof seg === 'string') {
          if (parts.length) parts.push(silence(GAP_MS));
          parts.push(await this.clip(seg));
        } else parts.push(silence(seg.pause));
      }
      const pcm = new Int16Array(parts.reduce((a, b) => a + b.length, 0));
      let off = 0;
      for (const x of parts) {
        pcm.set(x, off);
        off += x.length;
      }
      writeFileSync(out, wav(pcm));
    }
    return this.toFile(out);
  }

  /** 取得一句播报的音频文件（已预生成则直接返回，否则当场生成并缓存） */
  get(text: string): Promise<VoiceFile> {
    const hit = this.jobs.get(text);
    if (hit) return hit;
    const p = listLength(text) >= 3 ? this.stitch(text) : this.renderWhole(text);
    this.jobs.set(text, p);
    p.catch(() => this.jobs.delete(text));
    return p;
  }

  /** 是否已经生成好（不触发生成） */
  async ready(text: string): Promise<boolean> {
    const sub = listLength(text) >= 3 ? 'mix' : 'full';
    return existsSync(await this.path(sub, `${sha(text)}.${sub === 'mix' ? 'wav' : 'm4a'}`));
  }

  /** 预生成全部语音：所有整句 + 拼接名单用的片段 */
  async pregenerateAll(onProgress?: (done: number, total: number) => void, concurrency = 6) {
    if (!serverVoiceAvailable()) return;
    const { sentences, listTemplates } = voiceCatalog(MAX_SEATS);
    const fragments = new Set<string>();
    for (const t of listTemplates) for (const s of segments(t.replace('{L}', '1号、2号、3号'))) if (typeof s === 'string' && !/^\d/.test(s)) fragments.add(s);
    for (let i = 1; i <= MAX_SEATS; i++) fragments.add(`${i}号`);
    const todo: (() => Promise<unknown>)[] = [];
    for (const s of sentences) if (!(await this.ready(s))) todo.push(() => this.get(s));
    for (const f of fragments) todo.push(() => this.clip(f));
    const total = todo.length;
    let done = 0;
    await Promise.all(Array.from({ length: concurrency }, async () => {
      while (todo.length) {
        await todo.shift()!().catch((e) => console.error('[voice]', e?.message ?? e));
        onProgress?.(++done, total);
      }
    }));
    return { sentences: sentences.length, generated: total };
  }
}

/** 解析浏览器请求的语音文件路径（只允许缓存目录里的文件） */
export function voiceFilePath(dir: string, sub: string, file: string): string | null {
  if (!/^[\w.-]+-\d+$/.test(dir) || !['full', 'mix'].includes(sub) || !/^[0-9a-f]{20}\.(m4a|wav)$/.test(file)) return null;
  const f = resolve(DATA_DIR, 'voice', dir, sub, file);
  return existsSync(f) ? f : null;
}

const banks = new Map<number, VoiceBank>();
export function bank(rate: number): VoiceBank {
  const r = Math.round(rate) || 190;
  if (!banks.has(r)) banks.set(r, new VoiceBank(r));
  return banks.get(r)!;
}

/** 服务器本机播放（规则「语音播放」= 运行服务器的电脑）：依次用 afplay 播放，保证不重叠 */
export class SayQueue {
  private queue: { file: Promise<VoiceFile>; done: () => void }[] = [];
  private proc: ChildProcess | null = null;
  private busy = false;

  speak(text: string, rate: number, done: () => void) {
    this.queue.push({ file: bank(rate).get(text), done });
    if (!this.busy) void this.next();
  }

  private async next() {
    const item = this.queue.shift();
    if (!item) {
      this.busy = false;
      return;
    }
    this.busy = true;
    const file = await item.file.catch((e) => {
      console.error('[voice] 生成语音失败', e);
      return null;
    });
    if (!file) {
      item.done();
      return void this.next();
    }
    const p = spawn('afplay', [file.path], { stdio: 'ignore' });
    this.proc = p;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      this.proc = null;
      item.done();
      void this.next();
    };
    p.on('exit', finish);
    p.on('error', finish);
  }

  stop() {
    this.queue = [];
    this.proc?.kill();
    this.proc = null;
    this.busy = false;
  }
}
