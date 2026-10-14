import { getRole } from '@lw/engine';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GameOver } from '../components/GameOver.tsx';
import { HostControls } from '../components/HostControls.tsx';
import { JoinQR } from '../components/JoinQR.tsx';
import { Logs } from '../components/Logs.tsx';
import { SeatGrid } from '../components/SeatGrid.tsx';
import { RoleChip } from '../components/ui.tsx';
import { act, joinRoom, leaveRoom, onAnnounce } from '../lib/socket.ts';
import { VoiceBar } from '../components/VoiceBar.tsx';
import { useStore } from '../lib/store.ts';

export default function Display() {
  const { code = '' } = useParams();
  const lobby = useStore((s) => s.lobby);
  const game = useStore((s) => s.game);
  const user = useStore((s) => s.user)!;
  const toast = useStore((s) => s.toast);
  const [caption, setCaption] = useState<{ text: string; at: number } | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    joinRoom(code, true).catch((e) => toast(e.message, 'error'));
    return () => leaveRoom();
  }, [code]);

  useEffect(() => onAnnounce((a) => setCaption({ text: a.text, at: Date.now() })), []);

  // 字幕只显示当前或 8 秒内的播报，避免旧内容一直挂在大屏上
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!lobby || lobby.code !== code) return <div className="p-10 text-center text-slate-400">正在连接房间 {code}…</div>;
  const view = game?.view;
  const isHost = lobby.hostId === user.id || user.isAdmin;

  return (
    <div className="min-h-screen bg-night-950 p-4 lg:p-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="text-2xl font-bold">🐺 房间 {code}</div>
        <div className="text-slate-400">{lobby.config.presetName}</div>
        <div className="flex-1" />
        <Link to={`/room/${code}`} className="btn-ghost text-sm">我的手机视图</Link>
      </div>

      <div className="mb-4"><VoiceBar /></div>
      {!view ? (
        <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
          <div className="card flex flex-col items-center gap-3 p-6">
            <div className="text-6xl font-bold tracking-[0.3em]">{code}</div>
            <JoinQR path={`/room/${code}`} size={260} />
          </div>
          <div className="card">
            <div className="mb-3 flex flex-wrap gap-1">{Object.entries(lobby.config.board).filter(([, n]) => n > 0).map(([id, n]) => <RoleChip key={id} id={id} count={n} />)}</div>
            <SeatGrid cols={lobby.seats.length > 9 ? 6 : 4} cells={lobby.seats.map((s) => ({ seat: s.seat, name: s.name, empty: s.userId == null, bot: s.bot }))} />
            <p className="mt-4 text-center text-slate-400">玩家扫码登录后选择座位，坐满后房主开始游戏</p>
          </div>
        </div>
      ) : view.phase === 'over' ? (
        <div className="mx-auto max-w-3xl space-y-4">
          <GameOver view={view} />
          {isHost && <button className="btn-primary w-full" onClick={() => act('room:reset')}>再来一局</button>}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <div className={`card py-10 text-center ${view.phase === 'night' ? 'bg-night-900' : 'bg-gradient-to-br from-amber-500/20 to-sky-500/10'}`}>
              <div className="text-xl text-slate-400">{view.day === 0 ? '准备阶段' : view.phase === 'night' ? `🌙 第${view.day}夜` : `☀️ 第${view.day}天`}{view.paused && ' · ⏸ 已暂停'}</div>
              <div className="mt-3 text-4xl font-bold lg:text-6xl">
                {view.announce ?? (caption && Date.now() - caption.at < 8000 ? caption.text : view.stage)}
              </div>
              <div className="mt-3 text-2xl text-amber-200">
                {view.speech ? (view.speech.seat != null ? `🎤 ${view.speech.seat}号 ${view.speech.label}` : `💬 ${view.speech.label}`) : view.stage}
              </div>
            </div>
            <div className="card">
              <SeatGrid
                cols={view.players.length > 9 ? 6 : 4}
                cells={view.players.map((p) => ({
                  seat: p.seat, name: p.name, alive: p.alive, sheriff: p.sheriff, bot: p.isBot, speaking: view.speech?.seat === p.seat,
                  tag: p.revealed ? getRole(p.revealed)?.name : undefined,
                }))}
              />
            </div>
          </div>
          <div className="space-y-4">
            {isHost && <HostControls view={view} />}
            <Logs view={view} privateInfo={false} />
          </div>
        </div>
      )}
    </div>
  );
}
