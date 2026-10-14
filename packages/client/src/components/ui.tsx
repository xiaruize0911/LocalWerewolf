import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { roleEmoji, roleName, roleStyle } from '../lib/roles.ts';
import { serverNow, useStore } from '../lib/store.ts';

export function Page({ title, back, children, right }: { title?: ReactNode; back?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-4">
      {(title || back) && (
        <div className="mb-4 flex items-center gap-2">
          {back && <Link to={back} className="btn-ghost px-3 py-1.5 text-sm">‹ 返回</Link>}
          <h1 className="flex-1 truncate text-xl font-semibold">{title}</h1>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function RoleChip({ id, count }: { id: string; count?: number }) {
  return (
    <span className={`chip border ${roleStyle(id)}`}>
      {roleEmoji(id)} {roleName(id)}
      {count != null && count > 1 && <b>×{count}</b>}
    </span>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto max-w-md rounded-xl px-4 py-2 text-sm shadow-lg ${
            t.type === 'error' ? 'bg-rose-600 text-white' : t.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-night-600 text-slate-100'
          }`}
        >
          {t.text}
        </button>
      ))}
    </div>
  );
}

export function Countdown({ deadline, className = '' }: { deadline?: number; className?: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => tick((x) => x + 1), 250);
    return () => clearInterval(t);
  }, [deadline]);
  if (!deadline) return null;
  const left = Math.max(0, Math.ceil((deadline - serverNow()) / 1000));
  return <span className={`tabular-nums ${left <= 10 ? 'text-rose-300' : 'text-slate-400'} ${className}`}>⏱ {left}s</span>;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div className="card max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-b-none sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        {title && <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-semibold">{title}</h3><button className="text-slate-400" onClick={onClose}>✕</button></div>}
        {children}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-slate-500">{children}</div>;
}
