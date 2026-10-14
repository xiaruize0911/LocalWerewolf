import { hostname, networkInterfaces } from 'node:os';

/** 本机的局域网 IPv4 地址（en0 / Wi-Fi 优先） */
export function lanAddresses(): string[] {
  const out: { name: string; address: string }[] = [];
  for (const [name, list] of Object.entries(networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal) out.push({ name, address: a.address });
    }
  }
  const rank = (n: string) => (n === 'en0' ? 0 : /^(en|eth|wlan|wl)/.test(n) ? 1 : 2);
  return out.sort((a, b) => rank(a.name) - rank(b.name)).map((x) => x.address);
}

export function localHostname(): string {
  const h = hostname();
  return h.endsWith('.local') ? h : `${h}.local`;
}
