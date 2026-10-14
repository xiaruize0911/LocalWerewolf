import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.ts';
import { connectSocket } from '../lib/socket.ts';
import { useStore } from '../lib/store.ts';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const [params] = useSearchParams();
  const setUser = useStore((s) => s.setUser);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = mode === 'login' ? { username, password } : { username, password, displayName: displayName || undefined };
      const { user } = await api(`/api/auth/${mode}`, { body });
      setUser(user);
      connectSocket();
      nav(params.get('next') || '/', { replace: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="text-6xl">🐺</div>
        <h1 className="mt-3 text-2xl font-bold">狼人杀自动法官</h1>
        <p className="mt-1 text-sm text-slate-400">局域网面杀 · 手机操作 · 电脑播报</p>
      </div>
      <div className="mb-4 grid grid-cols-2 rounded-xl bg-white/5 p-1">
        {(['login', 'register'] as const).map((m) => (
          <button key={m} className={`rounded-lg py-2 text-sm ${mode === m ? 'bg-indigo-500 text-white' : 'text-slate-300'}`} onClick={() => setMode(m)}>
            {m === 'login' ? '登录' : '注册'}
          </button>
        ))}
      </div>
      <form className="space-y-3" onSubmit={submit}>
        <input className="input" placeholder="用户名" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input className="input" placeholder="密码" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
        {mode === 'register' && <input className="input" placeholder="昵称（选填，游戏中显示）" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />}
        {error && <div className="text-sm text-rose-300">{error}</div>}
        <button className="btn-primary w-full" disabled={busy || !username || !password}>{mode === 'login' ? '登录' : '注册并登录'}</button>
      </form>
      <Link to="/roles" className="mt-6 text-center text-sm text-indigo-300">先看看角色介绍 →</Link>
    </div>
  );
}
