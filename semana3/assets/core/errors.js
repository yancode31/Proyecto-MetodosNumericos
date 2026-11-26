/** SIMTELE-RISK · Teoría de errores transversal (Eₐ, Eᵣ, Eₚ, residual, normas, sensibilidad). */
export const normInf = (x) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
export const norm2 = (x) => Math.sqrt(x.reduce((s, v) => s + v * v, 0));
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const matVec = (A, x) => A.map((row) => dot(row, x));

/** Error absoluto, relativo (si r≠0) y porcentual. Nunca divide por cero. */
export function errorSet(approx, ref) {
  const abs = Math.abs(ref - approx);
  const rel = Math.abs(ref) > 0 ? abs / Math.abs(ref) : null;
  return { abs, rel, pct: rel === null ? null : 100 * rel };
}

/** Sensibilidad relativa (número de condición del problema respecto de un parámetro). */
export function relSensitivity(f, params, key, rel = 0.01) {
  const base = f(params);
  const p2 = { ...params, [key]: params[key] * (1 + rel) };
  const pert = f(p2);
  const dy = base !== 0 ? (pert - base) / Math.abs(base) : null;
  return { base, pert, delta: pert - base, relChange: dy, amplification: dy === null ? null : dy / rel };
}

/** Orden de convergencia observado entre refinamientos sucesivos (razón de pasos r). */
export function observedOrder(e1, e2, ratio = 2) {
  if (!(e1 > 0) || !(e2 > 0)) return null;
  return Math.log(e1 / e2) / Math.log(ratio);
}

/** PRNG reproducible (mulberry32) para experimentos Monte Carlo. */
export function rng(seed = 20261112) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function gauss(rand) {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function percentile(sorted, p) {
  if (!sorted.length) return NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}
export function stats(values) {
  const v = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  const n = v.length;
  const mean = v.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, n - 1));
  return { n, mean, sd, min: v[0], max: v[n - 1], p05: percentile(v, 0.05), p50: percentile(v, 0.5), p95: percentile(v, 0.95) };
}
export function histogram(values, bins = 24) {
  const v = values.filter(Number.isFinite);
  const lo = Math.min(...v), hi = Math.max(...v);
  const w = (hi - lo) / bins || 1;
  const counts = Array(bins).fill(0);
  for (const x of v) counts[Math.min(bins - 1, Math.floor((x - lo) / w))]++;
  return counts.map((c, i) => ({ x: lo + (i + 0.5) * w, count: c, share: c / v.length }));
}

/** Formato numérico uniforme para tablas. */
export function nfmt(x, digits = 8) {
  if (x === null || x === undefined) return '—';
  if (typeof x === 'boolean') return x ? 'Sí' : 'No';
  if (typeof x !== 'number') return String(x);
  if (!Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  const a = Math.abs(x);
  return a >= 1e-4 && a < 1e5 ? Number(x.toFixed(digits)).toString() : x.toExponential(3);
}
