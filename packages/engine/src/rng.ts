/** sfc32：状态可序列化的伪随机数生成器，保证同一种子可复现整局。 */
export type RngState = [number, number, number, number];

export function seedRng(seed: string | number[]): RngState {
  if (Array.isArray(seed)) {
    const s = [0, 0, 0, 0].map((_, i) => (seed[i] ?? i * 0x9e3779b9) >>> 0) as RngState;
    for (let i = 0; i < 12; i++) nextFloat(s);
    return s;
  }
  // xmur3 字符串哈希
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const next = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
  const s: RngState = [next(), next(), next(), next()];
  for (let i = 0; i < 12; i++) nextFloat(s);
  return s;
}

/** 返回 [0,1) 并原地推进状态 */
export function nextFloat(s: RngState): number {
  let [a, b, c, d] = s;
  a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  s[0] = a; s[1] = b; s[2] = c; s[3] = d;
  return (t >>> 0) / 4294967296;
}

export function shuffleInPlace<T>(s: RngState, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(nextFloat(s) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
