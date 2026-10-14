import { mySocketId } from '../lib/socket.ts';
import { useStore } from '../lib/store.ts';
import { enableVoiceHere } from '../lib/voice.ts';

/** 房主看到的语音状态条：哪台设备负责播报、本设备是否已开启声音 */
export function VoiceBar() {
  const lobby = useStore((s) => s.lobby);
  const user = useStore((s) => s.user);
  const unlocked = useStore((s) => s.voiceUnlocked);
  const toast = useStore((s) => s.toast);
  useStore((s) => s.connected);
  if (!lobby || !user || (lobby.hostId !== user.id && !user.isAdmin)) return null;

  if (lobby.voiceMode === 'server') {
    return <div className="card flex items-center gap-2 py-3 text-sm text-emerald-200">🔊 语音由运行服务器的电脑播放</div>;
  }

  const enable = () => enableVoiceHere().then(() => toast('本设备将播放语音', 'success')).catch((e) => toast(e.message, 'error'));
  const isSpeaker = lobby.speaker?.socketId === mySocketId();

  if (isSpeaker && unlocked) {
    return <div className="card flex items-center gap-2 py-3 text-sm text-emerald-200">🔊 本设备正在播放语音，请保持页面打开、音量调大</div>;
  }
  return (
    <div className="card flex flex-wrap items-center gap-3 border-amber-400/40 bg-amber-500/10 py-3">
      <div className="min-w-0 flex-1 text-sm">
        {isSpeaker
          ? '本设备负责播放语音，但浏览器需要先点一次才能出声。'
          : lobby.speaker
            ? `语音目前在你的另一台设备（${lobby.speaker.display ? '大屏页面' : '手机页面'}）上播放。`
            : '还没有设备负责播放语音。'}
      </div>
      <button className="btn-amber" onClick={enable}>🔈 {isSpeaker ? '开启语音' : '在本设备播放'}</button>
    </div>
  );
}
