import { api } from './api.ts';
import { emit, onAnnounce, type Announce } from './socket.ts';
import { useStore } from './store.ts';

/**
 * 房主设备上的语音播放器：播放服务器预生成的音频文件，播完后通知服务器进入下一步。
 * 浏览器要求先有一次点击才能出声，所以需要房主点一次「开启语音」。
 */
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=';
const queue: Announce[] = [];
let busy = false;
let player: HTMLAudioElement | null = null;
const preloaded = new Set<string>();

const audio = () => (player ??= new Audio());

function speakFallback(text: string, done: () => void) {
  if (!('speechSynthesis' in window)) return done();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  u.onend = done;
  u.onerror = done;
  window.speechSynthesis.speak(u);
}

function next() {
  const item = queue.shift();
  if (!item) {
    busy = false;
    return;
  }
  busy = true;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    emit('game:announceDone', { id: item.id }).catch(() => {});
    next();
  };
  setTimeout(finish, 5000 + [...item.text].length * 500);
  if (!item.audio) return speakFallback(item.text, finish);
  const a = audio();
  a.onended = finish;
  a.onerror = () => speakFallback(item.text, finish);
  a.src = item.audio;
  a.play().catch(() => speakFallback(item.text, finish));
}

onAnnounce((a) => {
  if (!a.play || !useStore.getState().voiceUnlocked) return;
  queue.push(a);
  if (!busy) next();
});

/** 在点击事件里调用：解锁音频，并把本设备设为播报设备 */
export async function enableVoiceHere() {
  const a = audio();
  a.src = SILENT;
  a.play().catch(() => {});
  useStore.setState({ voiceUnlocked: true });
  await emit('voice:claim');
  void preloadRoomVoice();
}

/** 预加载本局常用语音，播报时不用等下载 */
export async function preloadRoomVoice() {
  const code = useStore.getState().lobby?.code;
  if (!code) return;
  const { urls } = await api<{ urls: string[] }>(`/api/voice-manifest/${code}`).catch(() => ({ urls: [] as string[] }));
  const todo = urls.filter((u) => !preloaded.has(u));
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (todo.length) {
      const u = todo.shift()!;
      await fetch(u).then((r) => r.blob()).catch(() => {});
      preloaded.add(u);
    }
  }));
}
