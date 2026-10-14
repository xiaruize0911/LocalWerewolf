import { getRole, RULE_DEFS, RULE_GROUPS, type RuleDef, type Rules } from '@lw/engine';
import { useState } from 'react';

function Field({ d, value, onChange }: { d: RuleDef; value: any; onChange: (v: any) => void }) {
  const isDefault = value === d.default;
  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">{d.label}{!isDefault && <span className="ml-1 text-xs text-amber-300">已修改</span>}</div>
          {d.desc && <div className="text-xs text-slate-400">{d.desc}</div>}
        </div>
        {d.type === 'number' ? (
          <div className="flex shrink-0 items-center gap-1">
            <input type="number" className="input w-20 py-1.5 text-right" min={d.min} max={d.max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
            {d.unit && <span className="text-xs text-slate-400">{d.unit}</span>}
          </div>
        ) : (
          <select className="input w-auto max-w-[55%] shrink-0 py-1.5 text-sm" value={String(value)} onChange={(e) => {
            const opt = d.options!.find((o) => String(o.value) === e.target.value)!;
            onChange(opt.value);
          }}>
            {d.options!.map((o, i) => <option key={String(o.value)} value={String(o.value)}>{o.label}{i === 0 ? '（默认）' : ''}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

/** 规则选项：按常见程度分组排序，冷门选项折叠在「高级」里 */
export function RuleOptionsForm({ rules, onChange }: { rules: Rules; onChange: (r: Rules) => void }) {
  const [advanced, setAdvanced] = useState(false);
  return (
    <div className="space-y-3">
      {RULE_GROUPS.map((g) => {
        const defs = RULE_DEFS.filter((d) => d.group === g && (advanced || !d.advanced));
        if (!defs.length) return null;
        return (
          <details key={g} className="card py-2" open={g.startsWith('A') || g.startsWith('B')}>
            <summary className="cursor-pointer py-1 font-semibold">{g}</summary>
            <div className="divide-y divide-white/5">
              {defs.map((d) => <Field key={d.key} d={d} value={rules[d.key] ?? d.default} onChange={(v) => onChange({ ...rules, [d.key]: v })} />)}
            </div>
          </details>
        );
      })}
      <button className="btn-ghost w-full text-sm" onClick={() => setAdvanced((a) => !a)}>{advanced ? '隐藏高级选项' : '显示高级选项'}</button>
    </div>
  );
}

/** 板子里角色的专属选项 */
export function RoleConfigForm({ roles, config, onChange }: { roles: string[]; config: Record<string, Record<string, any>>; onChange: (c: Record<string, Record<string, any>>) => void }) {
  const withCfg = roles.map((id) => getRole(id)!).filter((r) => r?.config?.length);
  if (!withCfg.length) return null;
  return (
    <div className="card">
      <div className="mb-1 font-semibold">角色专属选项</div>
      <div className="divide-y divide-white/5">
        {withCfg.flatMap((r) =>
          r.config!.map((d) => (
            <Field key={`${r.id}.${d.key}`} d={{ ...d, label: `${r.name}：${d.label}` }} value={config[r.id]?.[d.key] ?? d.default}
              onChange={(v) => onChange({ ...config, [r.id]: { ...(config[r.id] ?? {}), [d.key]: v } })} />
          )),
        )}
      </div>
    </div>
  );
}
