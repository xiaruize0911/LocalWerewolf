import type { GameView, Payload, PromptView } from '@lw/engine';
import { useEffect, useMemo, useState } from 'react';
import { act } from '../lib/socket.ts';
import { Countdown } from './ui.tsx';
import { SeatGrid } from './SeatGrid.tsx';

function payloadText(p: Payload | undefined): string {
  if (!p) return '';
  if ('seat' in p) return p.seat == null ? '空' : `${p.seat}号`;
  if (p.values) return [p.values.target, p.values.target2].filter((x) => x != null).map((x) => `${x}号`).join('+') || '空';
  return '';
}

/** 渲染当前需要我完成的操作 */
export function PromptRenderer({ prompt, view }: { prompt: PromptView; view: GameView }) {
  const spec = prompt.spec;
  const [seat, setSeat] = useState<number | null>(null);
  const [two, setTwo] = useState<number[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const group = !!prompt.intents;
  const locked = prompt.closed || (prompt.submitted && !group);

  useEffect(() => {
    setSeat(prompt.response?.seat ?? null);
    setTwo([]);
    setValues({});
  }, [prompt.id]);

  const names = useMemo(() => new Map(view.players.map((p) => [p.seat, p.name])), [view.players]);

  const submit = async (payload: Payload) => {
    setBusy(true);
    await act('game:submit', { promptId: prompt.id, payload });
    setBusy(false);
  };

  const intentTags = useMemo(() => {
    const m = new Map<number, string>();
    for (const [s, p] of Object.entries(prompt.intents ?? {})) {
      const t = p.seat ?? p.values?.target;
      if (t != null) m.set(Number(t), (m.get(Number(t)) ? `${m.get(Number(t))},` : '') + `${s}号`);
    }
    return m;
  }, [prompt.intents]);

  const header = (
    <div className="mb-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-semibold">{spec.title}</h2>
        {!prompt.closed && <Countdown deadline={prompt.deadline} />}
      </div>
      {spec.desc && <p className="mt-1 whitespace-pre-line text-sm text-slate-300">{spec.desc}</p>}
    </div>
  );

  const footer = (
    <>
      {prompt.feedback && <div className="mt-3 rounded-xl bg-indigo-500/20 p-3 text-indigo-100">{prompt.feedback}</div>}
      {prompt.submitted && !prompt.feedback && (
        <div className="mt-3 text-center text-sm text-emerald-300">
          ✓ 已提交{group && !prompt.closed ? `（${payloadText(prompt.response)}），可以修改直到队友达成一致` : ''}
        </div>
      )}
      {group && Object.keys(prompt.intents ?? {}).length > 0 && (
        <div className="mt-2 text-xs text-rose-200">
          队友选择：{Object.entries(prompt.intents!).map(([s, p]) => `${s}号→${payloadText(p)}`).join('，')}
        </div>
      )}
    </>
  );

  if (spec.type === 'confirm') {
    return (
      <div className="card">
        {header}
        {!locked && <button className="btn-primary w-full" disabled={busy} onClick={() => submit({})}>{spec.okLabel ?? '确定'}</button>}
        {footer}
      </div>
    );
  }

  if (spec.type === 'choice') {
    return (
      <div className="card">
        {header}
        <div className="grid gap-2">
          {spec.options.map((o) => (
            <button key={o.value} className={prompt.response?.value === o.value ? 'btn-primary' : 'btn-ghost'} disabled={locked || busy} onClick={() => submit({ value: o.value })}>
              {o.label}
            </button>
          ))}
        </div>
        {footer}
      </div>
    );
  }

  if (spec.type === 'pickSeat') {
    const cells = view.players.map((p) => ({
      seat: p.seat, name: p.name, alive: p.alive, me: p.seat === view.me?.seat, sheriff: p.sheriff,
      disabled: locked || !spec.candidates.includes(p.seat), selected: seat === p.seat, tag: intentTags.get(p.seat),
    }));
    return (
      <div className="card">
        {header}
        <SeatGrid cells={cells} onPick={locked ? undefined : (s) => setSeat(s)} cols={view.players.length > 9 ? 4 : 3} />
        {!locked && (
          <div className="mt-4 flex gap-2">
            {spec.allowSkip && <button className="btn-ghost flex-1" disabled={busy} onClick={() => submit({ seat: null })}>{spec.skipLabel ?? '跳过'}</button>}
            <button className="btn-primary flex-[2]" disabled={busy || seat == null} onClick={() => submit({ seat })}>
              {seat == null ? '请选择玩家' : `确认选择 ${seat}号 ${names.get(seat) ?? ''}`}
            </button>
          </div>
        )}
        {footer}
      </div>
    );
  }

  if (spec.type === 'pickTwo') {
    const toggle = (s: number) => setTwo((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : cur.length >= 2 ? [cur[1], s] : [...cur, s]));
    const cells = view.players.map((p) => ({
      seat: p.seat, name: p.name, alive: p.alive, me: p.seat === view.me?.seat,
      disabled: locked || !spec.candidates.includes(p.seat), selected: two.includes(p.seat),
    }));
    return (
      <div className="card">
        {header}
        <SeatGrid cells={cells} onPick={locked ? undefined : toggle} cols={view.players.length > 9 ? 4 : 3} />
        {!locked && (
          <div className="mt-4 flex gap-2">
            {spec.allowSkip && <button className="btn-ghost flex-1" disabled={busy} onClick={() => submit({ seats: null })}>{spec.skipLabel ?? '跳过'}</button>}
            <button className="btn-primary flex-[2]" disabled={busy || two.length !== 2} onClick={() => submit({ seats: two })}>
              {two.length === 2 ? `确认：${two[0]}号 与 ${two[1]}号` : '请选择两名玩家'}
            </button>
          </div>
        )}
        {footer}
      </div>
    );
  }

  // form
  return (
    <div className="card">
      {header}
      <div className="space-y-4">
        {spec.fields.map((f) =>
          f.kind === 'toggle' ? (
            <label key={f.key} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
              <input type="checkbox" className="size-5 accent-indigo-500" disabled={locked} checked={!!values[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.checked }))} />
              <span>{f.label}</span>
            </label>
          ) : (
            <div key={f.key}>
              <div className="label mb-2">{f.label}{f.optional ? '（可不选）' : ''}</div>
              <SeatGrid
                cols={view.players.length > 9 ? 6 : 4}
                cells={view.players.map((p) => ({
                  seat: p.seat, name: p.name, alive: p.alive, me: p.seat === view.me?.seat,
                  disabled: locked || !(f.candidates ?? []).includes(p.seat), selected: values[f.key] === p.seat, tag: f.key === 'target' ? intentTags.get(p.seat) : undefined,
                }))}
                onPick={locked ? undefined : (s) => setValues((v) => ({ ...v, [f.key]: v[f.key] === s ? undefined : s }))}
              />
            </div>
          ),
        )}
      </div>
      {!locked && (
        <button className="btn-primary mt-4 w-full" disabled={busy} onClick={() => submit({ values })}>
          {spec.okLabel ?? '确认'}
        </button>
      )}
      {footer}
    </div>
  );
}
