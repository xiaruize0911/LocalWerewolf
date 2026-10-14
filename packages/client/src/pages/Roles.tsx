import { allNightActions, getRole, PRESETS } from '@lw/engine';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Empty, Page, RoleChip } from '../components/ui.tsx';
import { CATEGORY_LABEL, CATEGORY_STYLE, roleEmoji, rolesByCategory } from '../lib/roles.ts';
import { useStore } from '../lib/store.ts';

export function RolesPage() {
  const [q, setQ] = useState('');
  const user = useStore((s) => s.user);
  const groups = useMemo(
    () => rolesByCategory().map(([c, list]) => [c, list.filter((r) => !q || r.name.includes(q) || r.short.includes(q) || r.intro.skill.includes(q))] as const),
    [q],
  );
  return (
    <Page title="角色介绍" back={user ? '/' : '/login'}>
      <p className="mb-3 text-sm text-slate-400">新手先看「狼人、平民、预言家、女巫、猎人、白痴、守卫」这几个最常见的角色。点击卡片查看详细说明。</p>
      <input className="input mb-4" placeholder="搜索角色或技能，例如：查验、毒药" value={q} onChange={(e) => setQ(e.target.value)} />
      {groups.map(([cat, list]) =>
        list.length ? (
          <section key={cat} className="mb-6">
            <h2 className="mb-2 font-semibold">{CATEGORY_LABEL[cat]}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {list.map((r) => (
                <Link key={r.id} to={`/roles/${r.id}`} className={`card flex items-start gap-3 border py-3 hover:bg-night-700 ${CATEGORY_STYLE[cat]}`}>
                  <span className="text-3xl">{roleEmoji(r.id)}</span>
                  <div className="min-w-0">
                    <div className="font-semibold text-white">{r.name}</div>
                    <div className="text-sm text-slate-300">{r.short}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null,
      )}
      {groups.every(([, l]) => !l.length) && <Empty>没有找到相关角色</Empty>}
    </Page>
  );
}

export function RoleDetailPage() {
  const { id = '' } = useParams();
  const role = getRole(id);
  if (!role) return <Page title="角色不存在" back="/roles"><Empty>没有这个角色</Empty></Page>;
  const actions = allNightActions().filter((a) => a.roles.includes(id));
  const boards = PRESETS.filter((p) => (p.board[id] ?? 0) > 0);
  const order = allNightActions();
  return (
    <Page title={`${roleEmoji(id)} ${role.name}`} back="/roles">
      <div className={`card mb-4 border ${CATEGORY_STYLE[role.category]}`}>
        <div className="flex items-center gap-2">
          <span className="chip bg-black/20">{CATEGORY_LABEL[role.category]}</span>
          <span className="chip bg-black/20">{role.faction === 'wolf' ? '狼人阵营' : role.category === 'third' ? '好人阵营 / 可能成为第三方' : '好人阵营'}</span>
        </div>
        <p className="mt-3 text-lg text-white">{role.short}</p>
      </div>
      <div className="space-y-4">
        <section className="card">
          <h2 className="mb-1 font-semibold">技能</h2>
          <p className="text-slate-200">{role.intro.skill}</p>
        </section>
        <section className="card">
          <h2 className="mb-1 font-semibold">行动时机</h2>
          <p className="text-slate-200">{role.intro.timing}</p>
          {actions.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-slate-400">
              {actions.map((a) => (
                <li key={a.id}>
                  夜间第 {order.findIndex((x) => x.id === a.id) + 1} 顺位：「{a.name}请睁眼」
                  {a.firstNightOnly ? '（仅首夜）' : a.fromNight ? `（第${a.fromNight}晚起）` : '（每晚）'}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <h2 className="mb-1 font-semibold">新手提示</h2>
          <ul className="list-disc space-y-1 pl-5 text-slate-200">{role.intro.tips.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
        {role.intro.interactions?.length ? (
          <section className="card">
            <h2 className="mb-1 font-semibold">与其他角色的互动</h2>
            <ul className="list-disc space-y-1 pl-5 text-slate-200">{role.intro.interactions.map((t) => <li key={t}>{t}</li>)}</ul>
          </section>
        ) : null}
        {role.learnText && (
          <section className="card">
            <h2 className="mb-1 font-semibold">被机械狼学习时</h2>
            <p className="text-slate-200">机械狼获得：{role.learnText}</p>
          </section>
        )}
        {(role.intro.variants?.length || role.config?.length) ? (
          <section className="card">
            <h2 className="mb-1 font-semibold">规则变体（创建房间时可调整）</h2>
            <ul className="list-disc space-y-1 pl-5 text-slate-200">
              {role.intro.variants?.map((t) => <li key={t}>{t}</li>)}
              {role.config?.map((c) => <li key={c.key}>{c.label}</li>)}
            </ul>
          </section>
        ) : null}
        <section className="card">
          <h2 className="mb-2 font-semibold">出现在这些内置板子中</h2>
          {boards.length ? (
            <div className="flex flex-wrap gap-2">{boards.map((b) => <Link key={b.id} to="/boards" className="chip bg-white/10 py-1">{b.name}</Link>)}</div>
          ) : <p className="text-sm text-slate-400">暂无内置板子，可以在创建房间时自定义配板加入该角色。</p>}
        </section>
      </div>
    </Page>
  );
}

export function BoardsPage() {
  const user = useStore((s) => s.user);
  const order = allNightActions();
  return (
    <Page title="板子介绍" back={user ? '/' : '/login'}>
      <div className="space-y-4">
        {PRESETS.map((p) => {
          const steps = order.filter((a) => a.roles.some((r) => (p.board[r] ?? 0) > 0));
          return (
            <div key={p.id} className="card">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{p.name}</h2>
                <span className="chip bg-white/10">{p.difficulty}</span>
              </div>
              <p className="mt-1 text-sm text-slate-300">{p.desc}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {Object.entries(p.board).map(([id, n]) => <Link key={id} to={`/roles/${id}`}><RoleChip id={id} count={n} /></Link>)}
              </div>
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-400">{p.tips.map((t) => <li key={t}>{t}</li>)}</ul>
              <div className="mt-2 text-xs text-slate-500">夜间唤醒顺序：{steps.map((a) => a.name + (a.firstNightOnly ? '(首夜)' : '')).join(' → ')}</div>
              {user && <Link to={`/create?preset=${p.id}`} className="btn-primary mt-3 w-full">用这个板子开房间</Link>}
            </div>
          );
        })}
      </div>
    </Page>
  );
}
