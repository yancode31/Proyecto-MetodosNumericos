/** Raíces de g(t)=0: bisección, Newton-Raphson, secante (y Newton modificado para multiplicidad m). */
const rec = (k, x, g, ref) => ({ k, approx: x, residual: Math.abs(g(x)), error: ref === undefined ? null : Math.abs(x - ref) });

export function bisection(g, a, b, { tol = 1e-10, ref, maxIter = 200 } = {}) {
  const t0 = performance.now();
  let fa = g(a), fb = g(b);
  if (fa * fb > 0) throw Error('Bisección: no hay cambio de signo en el intervalo.');
  const trace = [rec(0, (a + b) / 2, g, ref)];
  trace[0].interval = [a, b];
  let l = a, r = b, fl = fa, converged = false;
  for (let k = 1; k <= maxIter; k++) {
    const m = (l + r) / 2, fm = g(m);
    trace.push({ ...rec(k, m, g, ref), interval: [l, r] });
    if (Math.abs(fm) < tol || (r - l) / 2 < tol * 1e-3) { converged = true; break; }
    if (fl * fm <= 0) r = m; else { l = m; fl = fm; }
  }
  const last = trace.at(-1);
  return { method: 'Bisección', root: last.approx, trace: trace.slice(1), converged, iterations: trace.length - 1, tol, maxIter, timeMs: performance.now() - t0, seed: `[${a}, ${b}]` };
}

export function newton(g, gp, x0, { tol = 1e-12, ref, maxIter = 100, multiplicity = 1, name = 'Newton-Raphson' } = {}) {
  const t0 = performance.now();
  let x = x0; const trace = [rec(0, x, g, ref)]; let converged = Math.abs(g(x)) < tol, note = '';
  for (let k = 1; k <= maxIter && !converged; k++) {
    const d = gp(x);
    if (!Number.isFinite(d) || Math.abs(d) < 1e-14) { note = 'Derivada casi nula.'; break; }
    const nx = x - multiplicity * g(x) / d;
    if (!Number.isFinite(nx)) { note = 'Iterado no finito.'; break; }
    x = nx; trace.push(rec(k, x, g, ref));
    if (Math.abs(g(x)) < tol) converged = true;
  }
  return { method: name, root: x, trace, converged, iterations: trace.length - 1, tol, maxIter, timeMs: performance.now() - t0, seed: `x₀ = ${x0}`, note };
}

export function secant(g, x0, x1, { tol = 1e-12, ref, maxIter = 100 } = {}) {
  const t0 = performance.now();
  let a = x0, b = x1, fa = g(a), fb = g(b);
  const trace = [rec(0, a, g, ref), rec(1, b, g, ref)];
  let converged = Math.abs(fb) < tol, note = '';
  for (let k = 2; k <= maxIter && !converged; k++) {
    const den = fb - fa;
    if (Math.abs(den) < 1e-300) { note = 'Denominador nulo.'; break; }
    const c = b - fb * (b - a) / den;
    if (!Number.isFinite(c)) { note = 'Iterado no finito.'; break; }
    a = b; fa = fb; b = c; fb = g(b); trace.push(rec(k, b, g, ref));
    if (Math.abs(fb) < tol) converged = true;
  }
  return { method: 'Secante', root: b, trace, converged, iterations: trace.length - 1, tol, maxIter, timeMs: performance.now() - t0, seed: `x₀ = ${x0}, x₁ = ${x1}`, note };
}

/** Orden de convergencia estimado con tres errores consecutivos: p ≈ ln(e_{k+1}/e_k)/ln(e_k/e_{k-1}). */
export function estimateOrder(trace) {
  const e = trace.map((t) => t.error).filter((v) => v !== null && v > 1e-14);
  if (e.length < 3) return null;
  const n = e.length;
  return Math.log(e[n - 1] / e[n - 2]) / Math.log(e[n - 2] / e[n - 3]);
}
/** Razón asintótica lineal e_{k+1}/e_k (útil para raíces múltiples). */
export function linearRatio(trace) {
  const e = trace.map((t) => t.error).filter((v) => v !== null && v > 1e-14);
  if (e.length < 2) return null;
  return e.at(-1) / e.at(-2);
}
export function runAllRoots(g, gp, { a, b, x0, s0, s1, ref, tolBis = 1e-10, tolNew = 1e-12 }) {
  return [bisection(g, a, b, { tol: tolBis, ref }), newton(g, gp, x0, { tol: tolNew, ref }), secant(g, s0, s1, { tol: tolNew, ref })];
}
