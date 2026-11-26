/** Utilidades comunes de los cuatro casos de estudio. */
import { nfmt, errorSet } from '../core/errors.js';
export { nfmt };

export const SCENARIOS = ['NORMAL', 'ESTRÉS', 'MAL CONDICIONADO'];
export const p = (key, label, unit, min, max, step, extra = {}) => ({ key, label, unit, min, max, step, type: 'number', ...extra });

/** Reduce una lista conservando primero y último (para gráficos y para guardar en BD). */
export function thin(list, max = 300) {
  if (list.length <= max) return list;
  const out = [], step = (list.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(list[Math.round(i * step)]);
  return out;
}
export const samples = (a, b, n, fn) => Array.from({ length: n + 1 }, (_, i) => { const t = a + ((b - a) * i) / n; return [t, fn(t)]; });
export const series = (name, points, extra = {}) => ({ name, points, ...extra });
export const safeLog = (v, floor = 1e-17) => Math.max(Math.abs(v), floor);

/** Construye una ejecución de método con el formato que se persiste en la BD (ejecucion_metodo + iteraciones + resumen). */
export function makeRun({ family, method, tolerance = null, step = null, maxIter = null, converged = true, timeMs = 0, iterations, reference, value, metrics = {}, interpretation = '', unit = '' }) {
  return {
    family, method, tolerance, step, maxIter, converged, timeMs: Number(timeMs.toFixed(3)),
    iterations: iterations.map((it, i) => ({
      k: it.k ?? i, approx: it.approx, residual: it.residual ?? null,
      error_abs: it.error_abs ?? it.error ?? null,
      error_rel: it.error_rel ?? null,
    })),
    summary: { reference, value, unit, metrics, interpretation },
  };
}
/** Convierte una traza de raíces / lineales en iteraciones persistibles. */
export function traceIterations(trace, ref) {
  return trace.map((t) => ({
    k: t.k, approx: t.approx, residual: t.residual,
    error_abs: t.error ?? null,
    error_rel: ref && typeof ref === 'number' && ref !== 0 && t.error != null ? t.error / Math.abs(ref) : null,
  }));
}
export function errorRow(label, approx, ref, unit = '', extra = []) {
  const e = errorSet(approx, ref);
  return [label, nfmt(approx), nfmt(ref), nfmt(e.abs), e.rel === null ? '—' : nfmt(e.rel), e.pct === null ? '—' : nfmt(e.pct) + ' %', ...extra];
}
export const tbl = (title, headers, rows, note = '') => ({ title, headers, rows, note });
export const sec = (id, title, intro, tables = [], plots = []) => ({ id, title, intro, tables, plots });

/** Filas de resumen de una corrida lineal para tabla. */
export function linearRows(solvers, A, b, xStar, residualOf, normInf, sub, nfm = nfmt) {
  return solvers.map((s) => [s.method, s.iterations, nfm(normInf(residualOf(A, s.x, b))), nfm(normInf(sub(s.x, xStar))), s.converged ? 'Sí' : 'No', nfm(s.timeMs, 3) + ' ms']);
}
