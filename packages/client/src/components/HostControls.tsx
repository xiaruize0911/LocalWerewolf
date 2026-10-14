import type { GameView } from '@lw/engine';
import { useState } from 'react';
import { act } from '../lib/socket.ts';

export function HostControls({ view, compact }: { view: GameView; compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  if (view.phase === 'over') return null;
  const host = (action: string) => act('game:host', { action });
  const speaking = !!view.speech;
  const free = view.speech && view.speech.seat == null;
  return (
    <div className="card">
      <button className="flex w-full items-center justify-between font-semibold" onClick={() => setOpen((o) => !o)}>
        <span>👑 房主控制</span>
        <span className="text-slate-400">{open ? '收起' : '展开'}</span>
      </button>
      {open && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {view.paused
            ? <button className="btn-amber" onClick={() => host('resume')}>▶ 继续</button>
            : <button className="btn-ghost" onClick={() => host('pause')}>⏸ 暂停</button>}
          {free ? (
            <button className="btn-primary" onClick={() => host('startVote')}>讨论结束，下一环节</button>
          ) : (
            <button className="btn-ghost" disabled={!speaking} onClick={() => host('nextSpeaker')}>下一位发言</button>
          )}
          <button className="btn-ghost" disabled={!speaking} onClick={() => host('skipAllSpeech')}>⏭ 跳过所有发言</button>
          <button className="btn-ghost" onClick={() => host('advance')} title="结束当前等待（未操作的按超时处理）">强制推进</button>
          <button className="btn-ghost col-span-2 text-rose-300" onClick={() => window.confirm('确定终止本局游戏？') && host('abort')}>终止游戏</button>
        </div>
      )}
    </div>
  );
}
