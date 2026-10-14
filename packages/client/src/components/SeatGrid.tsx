import type { ReactNode } from 'react';

export interface SeatCell {
  seat: number;
  name: string;
  alive?: boolean;
  empty?: boolean;
  me?: boolean;
  sheriff?: boolean;
  speaking?: boolean;
  bot?: boolean;
  tag?: ReactNode;
  disabled?: boolean;
  selected?: boolean;
}

export function SeatGrid({ cells, onPick, cols = 4 }: { cells: SeatCell[]; onPick?: (seat: number) => void; cols?: number }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {cells.map((c) => (
        <button
          key={c.seat}
          disabled={c.disabled || !onPick}
          onClick={() => onPick?.(c.seat)}
          className={[
            'relative flex aspect-square flex-col items-center justify-center rounded-2xl border p-1 text-center transition',
            c.selected ? 'border-indigo-300 bg-indigo-500/40 ring-2 ring-indigo-300' : c.me ? 'border-indigo-400/60 bg-indigo-500/15' : 'border-white/10 bg-night-700/60',
            c.alive === false ? 'opacity-40 grayscale' : '',
            c.speaking ? 'ring-2 ring-amber-300' : '',
            onPick && !c.disabled ? 'hover:bg-night-600 active:scale-95' : '',
            c.disabled && onPick ? 'opacity-35' : '',
          ].join(' ')}
        >
          <span className="text-lg font-bold leading-none">{c.seat}</span>
          <span className="mt-1 w-full truncate text-[11px] text-slate-300">{c.empty ? '空位' : c.name}</span>
          {c.sheriff && <span className="absolute left-1 top-1 text-xs">⭐</span>}
          {c.bot && <span className="absolute right-1 top-1 text-[10px]">🤖</span>}
          {c.alive === false && <span className="absolute inset-x-0 bottom-1 text-[10px] text-rose-300">出局</span>}
          {c.tag && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-rose-500 px-1 text-[10px] text-white">{c.tag}</span>}
        </button>
      ))}
    </div>
  );
}
