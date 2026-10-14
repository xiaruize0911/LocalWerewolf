import { defaultRules, getRole, normalizeRules, PRESETS, validateBoard, type Board, type Rules } from '@lw/engine';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BoardEditor, playerCountOf } from '../components/BoardEditor.tsx';
import { RoleConfigForm, RuleOptionsForm } from '../components/RuleOptionsForm.tsx';
import { Page, RoleChip } from '../components/ui.tsx';
import { api } from '../lib/api.ts';
import { emit, joinRoom } from '../lib/socket.ts';
import { useStore } from '../lib/store.ts';

interface MyPreset { id: number; name: string; playerCount: number; board: Board; rules: Rules; roleConfig: Record<string, any> }

/** 创建房间 / 修改房间设置 */
export default function Config() {
  const { code } = useParams();
  const editing = !!code;
  const [params] = useSearchParams();
  const nav = useNavigate();
  const toast = useStore((s) => s.toast);
  const lobby = useStore((s) => s.lobby);
  const [tab, setTab] = useState<'preset' | 'board' | 'rules'>(editing ? 'board' : 'preset');
  const [presetName, setPresetName] = useState(PRESETS[0].name);
  const [board, setBoard] = useState<Board>(PRESETS[0].board);
  const [rules, setRules] = useState<Rules>(normalizeRules(PRESETS[0].rules));
  const [roleConfig, setRoleConfig] = useState<Record<string, Record<string, any>>>({});
  const [mine, setMine] = useState<MyPreset[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/api/presets').then((r) => setMine(r.mine)).catch(() => {});
  }, []);

  useEffect(() => {
    const pid = params.get('preset');
    const p = PRESETS.find((x) => x.id === pid);
    if (p) choose(p.name, p.board, p.rules ?? {}, {});
  }, []);

  // 编辑模式：载入房间当前设置
  useEffect(() => {
    if (!editing || !code) return;
    if (!lobby || lobby.code !== code) {
      joinRoom(code).catch((e) => toast(e.message, 'error'));
      return;
    }
    setPresetName(lobby.config.presetName);
    setBoard(lobby.config.board);
    setRules(normalizeRules(lobby.config.rules));
    setRoleConfig(lobby.config.roleConfig ?? {});
  }, [editing, code, lobby?.code]);

  const choose = (name: string, b: Board, r: Partial<Rules>, rc: Record<string, any>) => {
    setPresetName(name);
    setBoard(b);
    setRules({ ...defaultRules(), ...normalizeRules(r) });
    setRoleConfig(rc);
    setTab('board');
    window.scrollTo(0, 0);
  };

  const players = playerCountOf(board);
  const err = validateBoard(board, players);
  const rolesInBoard = useMemo(() => Object.keys(board).filter((k) => board[k] > 0), [board]);
  const cfg = { playerCount: players, board, rules, roleConfig, presetName };

  const submit = async () => {
    setBusy(true);
    try {
      if (editing) {
        await emit('room:config', cfg);
        nav(`/room/${code}`);
      } else {
        const r = await emit('room:create', cfg);
        nav(`/room/${r.code}`);
      }
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const savePreset = async () => {
    const name = window.prompt('给这个板子起个名字', presetName.endsWith('（自定义）') ? presetName : `${presetName}（自定义）`);
    if (!name) return;
    try {
      await api('/api/presets', { body: { name, playerCount: players, board, rules, roleConfig } });
      toast('已保存到我的板子', 'success');
      setPresetName(name);
      const r = await api('/api/presets');
      setMine(r.mine);
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const removePreset = async (id: number) => {
    if (!window.confirm('删除这个板子？')) return;
    await api(`/api/presets/${id}`, { method: 'DELETE' });
    setMine((m) => m.filter((x) => x.id !== id));
  };

  return (
    <Page title={editing ? `房间 ${code} · 修改设置` : '创建房间'} back={editing ? `/room/${code}` : '/'}>
      <div className="sticky top-0 z-10 -mx-4 mb-4 bg-night-900/95 px-4 py-2 backdrop-blur">
        <div className="grid grid-cols-3 rounded-xl bg-white/5 p-1 text-sm">
          {([['preset', '① 选板子'], ['board', '② 配板'], ['rules', '③ 规则']] as const).map(([k, l]) => (
            <button key={k} className={`rounded-lg py-2 ${tab === k ? 'bg-indigo-500 text-white' : 'text-slate-300'}`} onClick={() => { setTab(k); window.scrollTo(0, 0); }}>{l}</button>
          ))}
        </div>
      </div>

      {tab === 'preset' && (
        <div className="space-y-3">
          {PRESETS.map((p) => (
            <button key={p.id} className="card w-full text-left hover:bg-night-700" onClick={() => choose(p.name, p.board, p.rules ?? {}, {})}>
              <div className="flex items-center justify-between">
                <div className="font-semibold">{p.name}</div>
                <span className="chip bg-white/10">{p.difficulty}</span>
              </div>
              <div className="mt-1 text-sm text-slate-400">{p.desc}</div>
              <div className="mt-2 flex flex-wrap gap-1">{Object.entries(p.board).map(([id, n]) => <RoleChip key={id} id={id} count={n} />)}</div>
            </button>
          ))}
          {mine.length > 0 && <h3 className="pt-2 text-sm text-slate-400">我的板子</h3>}
          {mine.map((p) => (
            <div key={p.id} className="card flex items-start gap-2">
              <button className="flex-1 text-left" onClick={() => choose(p.name, p.board, p.rules, p.roleConfig)}>
                <div className="font-semibold">{p.name} · {p.playerCount}人</div>
                <div className="mt-2 flex flex-wrap gap-1">{Object.entries(p.board).map(([id, n]) => <RoleChip key={id} id={id} count={n} />)}</div>
              </button>
              <button className="text-sm text-slate-500" onClick={() => removePreset(p.id)}>删除</button>
            </div>
          ))}
          <button className="btn-ghost w-full" onClick={() => choose('自定义', { werewolf: 2, villager: 2, seer: 1, witch: 1 }, {}, {})}>从空白开始自定义</button>
        </div>
      )}

      {tab === 'board' && (
        <>
          <input className="input mb-3" value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="板子名称" />
          <BoardEditor board={board} onChange={setBoard} />
        </>
      )}

      {tab === 'rules' && (
        <div className="space-y-3">
          <RoleConfigForm roles={rolesInBoard} config={roleConfig} onChange={setRoleConfig} />
          <RuleOptionsForm rules={rules} onChange={setRules} />
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 mt-6 border-t border-white/5 bg-night-900/95 px-4 py-3 backdrop-blur">
        <div className="mb-2 flex flex-wrap gap-1">{rolesInBoard.map((id) => <RoleChip key={id} id={id} count={board[id]} />)}</div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={savePreset} disabled={!!err}>保存为我的板子</button>
          <button className="btn-primary flex-1" disabled={!!err || busy} onClick={submit}>
            {err ? err : editing ? '保存设置' : `创建 ${players} 人房间`}
          </button>
        </div>
        {rolesInBoard.some((id) => !getRole(id)) && <div className="text-rose-300">包含未知角色</div>}
      </div>
    </Page>
  );
}
