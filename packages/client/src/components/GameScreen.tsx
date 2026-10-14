import type { GameView } from '@lw/engine';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { act } from '../lib/socket.ts';
import { roleEmoji, roleStyle } from '../lib/roles.ts';
import type { GamePacket } from '../lib/store.ts';
import { GameOver } from './GameOver.tsx';
import { HostControls } from './HostControls.tsx';
import { Logs } from './Logs.tsx';
import { PromptRenderer } from './PromptRenderer.tsx';
import { SeatGrid } from './SeatGrid.tsx';
import { getRole } from '@lw/engine';
import { Modal } from './ui.tsx';

/** 按住才显示身份，防止被旁边的人看到 */
function RoleCard({ view }: { view: GameView }) {
  const [show, setShow] = useState(false);
  const me = view.me!;
  const role = getRole(me.role)!;
  return (
    <div
      className={`card select-none border ${show ? roleStyle(me.role) : ''}`}
      onPointerDown={() => setShow(true)}
      onPointerUp={() => setShow(false)}
      onPointerLeave={() => setShow(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {show ? (
        <div className="flex items-center gap-3">
          <div className="text-5xl">{roleEmoji(me.role)}</div>
          <div className="min-w-0 flex-1">
            <div className="text-xl font-bold">{me.roleName}<span className="ml-2 text-sm font-normal">{me.side === 'wolf' ? '狼人阵营' : '好人阵营'}{me.thirdTeam ? ' · 第三方' : ''}</span></div>
            <div className="text-sm text-slate-300">{role.short}</div>
            {me.wolfTeam.length > 0 && <div className="mt-1 text-sm text-rose-300">狼队友：{me.wolfTeam.map((s) => `${s}号`).join('、')}</div>}
            {me.lover != null && <div className="mt-1 text-sm text-pink-300">情侣：{me.lover}号</div>}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">{me.seat}号 {view.players.find((p) => p.seat === me.seat)?.name}{!me.alive && <span className="ml-2 text-sm text-rose-300">已出局</span>}</div>
            <div className="text-sm text-slate-400">👆 按住这里查看身份</div>
          </div>
          <Link to={`/roles/${me.role}`} onPointerDown={(e) => e.stopPropagation()} className="text-sm text-indigo-300">角色说明</Link>
        </div>
      )}
    </div>
  );
}

function DayActions({ view }: { view: GameView }) {
  const [duel, setDuel] = useState(false);
  const { explode, duel: canDuel, withdraw } = view.actions;
  if (!explode && !canDuel && !withdraw) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {withdraw && <button className="btn-ghost flex-1" onClick={() => window.confirm('确定退水（退出警长竞选）？') && act('game:dayAction', { action: 'withdraw' })}>退水</button>}
      {canDuel && <button className="btn-amber flex-1" onClick={() => setDuel(true)}>⚔️ 发起决斗</button>}
      {explode && <button className="btn-danger flex-1" onClick={() => window.confirm('确定自爆？你会立即出局。') && act('game:dayAction', { action: 'explode' })}>💥 自爆</button>}
      <Modal open={duel} onClose={() => setDuel(false)} title="选择决斗对象">
        <SeatGrid
          cols={4}
          cells={view.players.map((p) => ({ seat: p.seat, name: p.name, alive: p.alive, disabled: !p.alive || p.seat === view.me?.seat }))}
          onPick={(seat) => {
            if (window.confirm(`确定与 ${seat}号 决斗？对方是好人的话你会出局。`)) {
              act('game:dayAction', { action: 'duel', target: seat });
              setDuel(false);
            }
          }}
        />
      </Modal>
    </div>
  );
}

export function GameScreen({ packet }: { packet: GamePacket }) {
  const { view, isHost } = packet;
  const me = view.me;
  const night = view.phase === 'night';
  const prompt = view.prompt;

  if (view.phase === 'over') {
    return (
      <div className="space-y-4">
        <GameOver view={view} />
        <Logs view={view} />
      </div>
    );
  }

  const mySpeech = view.speech?.seat != null && view.speech.seat === me?.seat;

  return (
    <div className="space-y-4">
      <div className={`card text-center ${night ? 'bg-night-950' : 'bg-gradient-to-br from-amber-500/20 to-sky-500/10'}`}>
        <div className="text-sm text-slate-400">{view.day === 0 ? '准备阶段' : night ? `🌙 第${view.day}夜` : `☀️ 第${view.day}天`}{view.paused && ' · ⏸ 已暂停'}</div>
        <div className="mt-1 text-xl font-semibold">{view.stage}</div>
        {view.speech && <div className="mt-1 text-amber-200">{view.speech.seat != null ? `🎤 ${view.speech.seat}号 ${view.speech.label}` : `💬 ${view.speech.label}`}</div>}
      </div>

      {me && <RoleCard view={view} />}

      {prompt ? (
        <PromptRenderer prompt={prompt} view={view} />
      ) : night ? (
        <div className="card py-12 text-center">
          <div className="text-6xl">🌙</div>
          <div className="mt-3 text-lg">天黑请闭眼</div>
          <div className="mt-1 text-sm text-slate-500">轮到你行动时这里会出现操作</div>
        </div>
      ) : null}

      {mySpeech && (
        <button className="btn-amber w-full py-4 text-lg" onClick={() => act('game:speechEnd')}>🎤 我说完了，结束发言</button>
      )}

      {!night && me?.alive && <DayActions view={view} />}

      {!night && (
        <div className="card">
          <SeatGrid
            cols={view.players.length > 9 ? 4 : 3}
            cells={view.players.map((p) => ({
              seat: p.seat, name: p.name, alive: p.alive, me: p.seat === me?.seat, sheriff: p.sheriff, bot: p.isBot,
              speaking: view.speech?.seat === p.seat, tag: p.revealed ? getRole(p.revealed)?.name : undefined,
            }))}
          />
        </div>
      )}

      {isHost && <HostControls view={view} compact />}
      <Logs view={view} />
    </div>
  );
}
