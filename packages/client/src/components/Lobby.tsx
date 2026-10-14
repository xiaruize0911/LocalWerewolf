import { Link, useNavigate } from 'react-router-dom';
import { act } from '../lib/socket.ts';
import { useStore, type LobbyState } from '../lib/store.ts';
import { JoinQR } from './JoinQR.tsx';
import { SeatGrid } from './SeatGrid.tsx';
import { RoleChip } from './ui.tsx';

export function Lobby({ lobby }: { lobby: LobbyState }) {
  const user = useStore((s) => s.user)!;
  const nav = useNavigate();
  const isHost = lobby.hostId === user.id || user.isAdmin;
  const mySeat = lobby.seats.find((s) => s.userId === user.id)?.seat ?? null;
  const empty = lobby.seats.filter((s) => s.userId == null).length;

  const pick = (seat: number) => {
    const s = lobby.seats[seat - 1];
    if (s.userId == null) return act('seat:take', { seat });
    if (s.userId === user.id) return act('seat:leave');
    if (isHost && window.confirm(`把 ${seat}号 ${s.name} 移出座位？`)) return act('room:kick', { seat });
  };

  const close = async () => {
    if (!window.confirm('确定关闭房间？')) return;
    await act('room:close');
    nav('/');
  };

  return (
    <div className="space-y-4">
      <div className="card flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <JoinQR path={`/room/${lobby.code}`} size={150} />
        <div className="flex-1 text-center sm:text-left">
          <div className="text-sm text-slate-400">房间号</div>
          <div className="text-4xl font-bold tracking-[0.3em]">{lobby.code}</div>
          <div className="mt-2 text-sm">{lobby.config.presetName} · {lobby.config.playerCount}人 · 房主 {lobby.hostName}</div>
          <div className="mt-2 flex flex-wrap justify-center gap-1 sm:justify-start">
            {Object.entries(lobby.config.board).filter(([, n]) => n > 0).map(([id, n]) => (
              <Link key={id} to={`/roles/${id}`}><RoleChip id={id} count={n} /></Link>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-semibold">选择座位 <span className="text-sm font-normal text-slate-400">（{lobby.seats.length - empty}/{lobby.seats.length}）</span></div>
          {mySeat && <span className="text-sm text-indigo-300">你在 {mySeat}号，点击自己可离座</span>}
        </div>
        <SeatGrid
          cols={lobby.seats.length > 9 ? 4 : 3}
          onPick={pick}
          cells={lobby.seats.map((s) => ({ seat: s.seat, name: s.name, empty: s.userId == null, me: s.userId === user.id, bot: s.bot }))}
        />
      </div>

      {isHost ? (
        <div className="grid gap-2">
          <button className="btn-primary py-4 text-lg" disabled={empty > 0} onClick={() => act('game:start')}>
            {empty > 0 ? `还差 ${empty} 人` : '开始游戏'}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <Link className="btn-ghost" to={`/room/${lobby.code}/config`}>修改设置</Link>
            <Link className="btn-ghost" to={`/display/${lobby.code}`} target="_blank">打开大屏（播报）</Link>
            <button className="btn-ghost" disabled={!empty} onClick={() => act('room:bots')}>空位填充机器人</button>
            <button className="btn-ghost text-rose-300" onClick={close}>关闭房间</button>
          </div>
          <p className="text-center text-xs text-slate-500">
            {lobby.voiceMode === 'server' ? '语音由运行服务器的电脑播放。' : '语音在房主的设备上播放：建议在房主电脑上打开「大屏」并点「开启语音」。'}
            机器人仅用于测试，会随机行动。
          </p>
        </div>
      ) : (
        <p className="text-center text-sm text-slate-400">等待房主开始游戏…</p>
      )}
    </div>
  );
}
