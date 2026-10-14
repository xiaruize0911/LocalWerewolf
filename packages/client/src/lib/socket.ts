import { io, type Socket } from 'socket.io-client';
import { useStore } from './store.ts';

export interface Announce {
  id: string;
  text: string;
  /** 本设备是否负责播放 */
  play: boolean;
  audio: string | null;
}
type Listener = (a: Announce) => void;

let socket: Socket | null = null;
let joined: { code: string; display: boolean } | null = null;
const announceListeners = new Set<Listener>();

export function onAnnounce(fn: Listener) {
  announceListeners.add(fn);
  return () => {
    announceListeners.delete(fn);
  };
}

async function syncClock(s: Socket) {
  const t0 = Date.now();
  const res = await s.timeout(5000).emitWithAck('time:ping', {}).catch(() => null);
  if (res?.now) useStore.setState({ clockOffset: res.now - (t0 + Date.now()) / 2 });
}

export const mySocketId = () => socket?.id ?? null;

export function getSocket(): Socket {
  if (socket) return socket;
  const s = io({ withCredentials: true, autoConnect: false, transports: ['websocket', 'polling'] });
  s.on('connect', () => {
    useStore.setState({ connected: true });
    void syncClock(s);
    if (joined) s.emit('room:join', joined, (res: any) => {
      if (!res?.ok) {
        useStore.getState().toast(res?.error ?? '重新加入房间失败', 'error');
        joined = null;
        useStore.setState({ lobby: null, game: null });
      }
    });
  });
  s.on('disconnect', () => useStore.setState({ connected: false }));
  s.on('connect_error', (e) => {
    if (e.message === 'unauthorized') useStore.setState({ user: null });
  });
  s.on('room:state', (lobby) => useStore.setState({ lobby }));
  s.on('game:view', (game) => useStore.setState({ game }));
  s.on('toast', (t) => useStore.getState().toast(t.text, t.type));
  s.on('announce', (a) => announceListeners.forEach((fn) => fn(a)));
  s.on('room:closed', () => {
    joined = null;
    useStore.setState({ lobby: null, game: null });
    useStore.getState().toast('房间已关闭');
  });
  socket = s;
  return s;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
}

export function disconnectSocket() {
  joined = null;
  socket?.disconnect();
  useStore.setState({ lobby: null, game: null, connected: false });
}

/** 发送事件并等待服务器确认，失败时抛出错误信息 */
export async function emit<T = any>(event: string, data: any = {}): Promise<T> {
  const s = getSocket();
  if (!s.connected) s.connect();
  const res = await s.timeout(8000).emitWithAck(event, data).catch(() => ({ ok: false, error: '网络超时，请重试' }));
  if (!res?.ok) throw new Error(res?.error ?? '操作失败');
  return res as T;
}

/** 发送并在失败时弹出提示 */
export async function act(event: string, data: any = {}) {
  try {
    return await emit(event, data);
  } catch (e: any) {
    useStore.getState().toast(e.message, 'error');
    return null;
  }
}

export async function joinRoom(code: string, display = false) {
  const res = await emit('room:join', { code, display });
  joined = { code, display };
  return res;
}

export function leaveRoom() {
  joined = null;
  socket?.emit('room:leave');
  useStore.setState({ lobby: null, game: null });
}

export function rememberJoined(code: string) {
  joined = { code, display: false };
}
