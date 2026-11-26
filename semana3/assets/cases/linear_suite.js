/** Suite de sistemas lineales SPD 4×4 (informe de la Semana 1) con los cuatro métodos y referencia directa. */
import { normInf, sub, nfmt, matVec } from '../core/errors.js';
import { runLinear, solveDirect, systemInfo, LINEAR_METHODS, residualVec, luSolve, luFactor, cond2 } from '../core/linear.js';
import { makeRun, series, tbl, thin, safeLog } from './common.js';

export function linearMatrix(scenario) {
  if (scenario === 'MAL CONDICIONADO') {
    const A = [[1, 0, 0, 0], [0, 1e-2, 0, 0], [0, 0, 1e-4, 0], [0, 0, 0, 1e-6]], xStar = [1, 1, 1, 1];
    return { A, xStar, b: matVec(A, xStar), label: 'A = diag(1, 10⁻², 10⁻⁴, 10⁻⁶)' };
  }
  const A = scenario === 'ESTRÉS'
    ? [[2.01, -1, 0, 0], [-1, 2.01, -1, 0], [0, -1, 2.01, -1], [0, 0, -1, 2.01]]
    : [[4, 1, 0, 0], [1, 4, 1, 0], [0, 1, 4, 1], [0, 0, 1, 3]];
  const xStar = [1, 2, 3, 4];
  return { A, xStar, b: matVec(A, xStar), label: scenario === 'ESTRÉS' ? 'tridiagonal (2.01, −1)' : 'tridiagonal (4, 1; último 3)' };
}
const fmtVec = (v, d = 4) => v.map((x) => nfmt(Number(x.toFixed(d)))).join(', ');

export function linearSuite(scenario, { A, xStar, b, label } = linearMatrix(scenario), opts = {}) {
  const tol = opts.tol ?? 1e-10, maxIter = opts.maxIter ?? 10000;
  const info = systemInfo(A);
  const xRef = solveDirect(A, b);
  const runs = LINEAR_METHODS.map((m) => runLinear(m, A, b, xStar, { tol, maxIter }));
  const dbRuns = runs.map((s) => makeRun({
    family: 'Sistemas lineales', method: s.method, tolerance: tol, step: null, maxIter, converged: s.converged, timeMs: s.timeMs,
    iterations: s.trace.map((t) => ({ k: t.k, approx: t.approx, residual: t.residual, error_abs: t.error, error_rel: normInf(xStar) > 0 ? t.error / normInf(xStar) : null })),
    reference: `x* = (${fmtVec(xStar, 6)})`, value: s.x,
    metrics: { residual_inf: normInf(residualVec(A, s.x, b)), error_inf: normInf(sub(s.x, xStar)), iteraciones: s.iterations, kappa2: info.cond2 },
    interpretation: s.note || (s.converged ? 'Convergió al criterio ‖b−Ax‖∞ < tol.' : 'No alcanzó la tolerancia.'),
  }));
  const rows = runs.map((s) => [s.method, s.iterations, nfmt(normInf(residualVec(A, s.x, b))), nfmt(normInf(sub(s.x, xStar))), nfmt(normInf(sub(s.x, xRef))), s.converged ? 'Sí' : 'No', nfmt(s.timeMs, 3)]);
  const iterRows = [];
  for (const s of runs) {
    const ks = s.trace.length <= 6 ? s.trace.map((t) => t.k) : [0, 1, 2, 3, 4, Math.floor(s.trace.length / 2), s.trace.length - 1];
    for (const k of [...new Set(ks)]) { const z = s.trace[k]; iterRows.push([s.method, z.k, fmtVec(z.approx), nfmt(z.residual), nfmt(z.error)]); }
  }
  const conv = tbl('Condiciones de convergencia y condicionamiento', ['Propiedad', 'Valor', 'Implicación'], [
    ['Simétrica', info.symmetric ? 'Sí' : 'No', 'Requisito de gradiente conjugado estándar'],
    ['Definida positiva (Cholesky)', info.spd ? 'Sí' : 'No', 'Garantiza convergencia de Gauss-Seidel y de CG'],
    ['Diagonal estrictamente dominante', info.diagDominant ? `Sí (máx. razón ${nfmt(info.ddRatio, 4)})` : `No (máx. razón ${nfmt(info.ddRatio, 4)})`, 'Suficiente para Jacobi y Gauss-Seidel'],
    ['ρ(T_Jacobi)', info.rhoJacobi === null ? '—' : nfmt(info.rhoJacobi, 6), 'Jacobi converge si ρ < 1; menor ρ → menos iteraciones'],
    ['λ_min, λ_max', info.spd ? `${nfmt(info.lambdaMin, 6)}, ${nfmt(info.lambdaMax, 6)}` : '—', 'Extremos del espectro'],
    ['κ₂(A)', nfmt(info.cond2, 8), 'Cota: ‖δx‖/‖x‖ ≲ κ₂ · ‖δb‖/‖b‖'],
  ]);
  const plot = {
    title: `Convergencia de sistemas lineales (${scenario})`, xLabel: 'Iteración', yLabel: 'Residual ‖b−Ax‖∞', logY: true,
    series: runs.map((s) => series(s.method, thin(s.trace.map((t) => [t.k, safeLog(t.residual)]), 160), s.trace.length <= 8 ? { markers: true } : {})),
    hlines: [{ y: tol, label: 'Tolerancia' }],
  };
  let perturbation = null;
  if (scenario === 'MAL CONDICIONADO') {
    const db = [0, 0, 0, 1e-6], xp = luSolve(luFactor(A), b.map((v, i) => v + db[i])).x;
    perturbation = { relB: normInf(db) / normInf(b), relX: normInf(sub(xp, xStar)) / normInf(xStar), xPert: xp };
  }
  return { A, b, xStar, xRef, label, info, runs, dbRuns, rows, iterRows, conv, plot, perturbation, tol, maxIter,
    summaryTable: tbl(`Sistema lineal 4×4 (${label}) — comparación de métodos`, ['Método', 'Pasos', '‖b−Ax‖∞', '‖x−x*‖∞', '‖x−x_dir‖∞', 'Convergió', 'Tiempo (ms)'], rows),
    iterTable: tbl('Iteraciones registradas (x⁽ᵏ⁾, residual y error)', ['Método', 'k', 'x⁽ᵏ⁾', 'Residual ∞', 'Error ∞'], iterRows),
  };
}
