import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { GameScreen } from '../components/GameScreen.tsx';
import { Lobby } from '../components/Lobby.tsx';
import { Page } from '../components/ui.tsx';
import { VoiceBar } from '../components/VoiceBar.tsx';
import { act, joinRoom, leaveRoom } from '../lib/socket.ts';
import { useStore } from '../lib/store.ts';

export default function Room() {
  const { code = '' } = useParams();
  const nav = useNavigate();
  const lobby = useStore((s) => s.lobby);
  const game = useStore((s) => s.game);
  const user = useStore((s) => s.user)!;
  const connected = useStore((s) => s.connected);
  const toast = useStore((s) => s.toast);

  useEffect(() => {
    joinRoom(code).catch((e) => {
      toast(e.message, 'error');
      nav('/');
    });
    return () => leaveRoom();
  }, [code]);

  if (!lobby || lobby.code !== code) return <Page title={`房间 ${code}`} back="/"><div className="py-20 text-center text-slate-400">正在进入房间…</div></Page>;

  const isHost = lobby.hostId === user.id || user.isAdmin;
  return (
    <Page
      title={<span>房间 {code}{!connected && <span className="ml-2 text-sm text-rose-300">连接中断，正在重连…</span>}</span>}
      back="/"
      right={lobby.started && <Link to={`/display/${code}`} target="_blank" className="btn-ghost px-3 py-1.5 text-sm">大屏</Link>}
    >
      <div className="mb-4"><VoiceBar /></div>
      {game && lobby.started ? (
        <>
          <GameScreen packet={game} />
          {lobby.over && isHost && (
            <button className="btn-primary mt-4 w-full" onClick={() => act('room:reset')}>再来一局（回到房间）</button>
          )}
        </>
      ) : (
        <Lobby lobby={lobby} />
      )}
    </Page>
  );
}
