import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { api } from '../lib/api.ts';

/** 局域网加入地址 + 二维码 */
export function useJoinUrls(path: string) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const port = window.location.port ? `:${window.location.port}` : '';
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    api('/api/lan')
      .then((r) => {
        const list = r.ips.map((ip: string) => `http://${ip}${port}${path}`);
        list.push(`http://${r.hostname}${port}${path}`);
        setUrls(isLocal ? list : [`${window.location.origin}${path}`, ...list.filter((u: string) => !u.startsWith(window.location.origin))]);
      })
      .catch(() => setUrls([`${window.location.origin}${path}`]));
  }, [path]);
  return urls;
}

export function JoinQR({ path, size = 180 }: { path: string; size?: number }) {
  const urls = useJoinUrls(path);
  const [img, setImg] = useState('');
  useEffect(() => {
    if (urls[0]) QRCode.toDataURL(urls[0], { margin: 1, width: size * 2 }).then(setImg);
  }, [urls[0]]);
  return (
    <div className="flex flex-col items-center gap-2">
      {img ? <img src={img} width={size} height={size} className="rounded-xl bg-white p-1" alt="加入二维码" /> : <div style={{ width: size, height: size }} className="rounded-xl bg-white/10" />}
      <div className="text-center text-xs text-slate-400">
        同一 WiFi 下扫码或打开：
        {urls.slice(0, 2).map((u) => <div key={u} className="select-all break-all font-mono text-slate-200">{u}</div>)}
      </div>
    </div>
  );
}
