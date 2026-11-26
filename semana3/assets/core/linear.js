/** Sistemas lineales A x = b (n ≥ 4): Jacobi, Gauss-Seidel, LU, gradiente conjugado y referencia directa. */
import { normInf, dot, sub, matVec } from './errors.js';

export const residualVec = (A, x, b) => sub(b, matVec(A, x));
export const transpose = (A) => A[0].map((_, j) => A.map((r) => r[j]));
export const matMul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));

/** Eliminación gaussiana con pivoteo parcial: solución directa de referencia. */
export function solveDirect(Ain, bin) {
  const n = bin.length, A = Ain.map((r, i) => [...r, bin[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-300) throw Error('Matriz singular.');
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
    }
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = A[i][n];
    for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j];
    x[i] = s / A[i][i];
  }
  return x;
}

/** Factorización LU (Doolittle). Con pivoteo parcial si hace falta. Devuelve L, U, P y la solución. */
export function luFactor(Ain) {
  const n = Ain.length, U = Ain.map((r) => r.slice());
  const L = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  const perm = [...Array(n).keys()];
  let swaps = 0;
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(U[i][k]) > Math.abs(U[p][k])) p = i;
    if (Math.abs(U[p][k]) < 1e-300) throw Error('Pivote nulo en LU.');
    if (p !== k) {
      [U[k], U[p]] = [U[p], U[k]];
      [perm[k], perm[p]] = [perm[p], perm[k]];
      for (let j = 0; j < k; j++) [L[k][j], L[p][j]] = [L[p][j], L[k][j]];
      swaps++;
    }
    for (let i = k + 1; i < n; i++) {
      L[i][k] = U[i][k] / U[k][k];
      for (let j = k; j < n; j++) U[i][j] -= L[i][k] * U[k][j];
      U[i][k] = 0;
    }
  }
  return { L, U, perm, swaps };
}
export function luSolve({ L, U, perm }, b) {
  const n = b.length, pb = perm.map((i) => b[i]), y = Array(n).fill(0), x = Array(n).fill(0);
  for (let i = 0; i < n; i++) { let s = pb[i]; for (let j = 0; j < i; j++) s -= L[i][j] * y[j]; y[i] = s; }
  for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let j = i + 1; j < n; j++) s -= U[i][j] * x[j]; x[i] = s / U[i][i]; }
  return { x, y };
}

/** Autovalores de una matriz simétrica por rotaciones de Jacobi. */
export function symEigenvalues(Ain) {
  const n = Ain.length, A = Ain.map((r) => r.slice());
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] ** 2;
    if (off < 1e-30) break;
    for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-300) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
      for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
    }
  }
  return A.map((r, i) => r[i]).sort((a, b) => a - b);
}

/** Valores singulares por Jacobi unilateral (Hestenes): precisos aun con κ ~ 10⁹. */
export function singularValues(Ain) {
  const m = Ain.length, n = Ain[0].length, U = Ain.map((r) => r.slice());
  for (let sweep = 0; sweep < 60; sweep++) {
    let rotated = false;
    for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
      let a = 0, b = 0, g = 0;
      for (let i = 0; i < m; i++) { a += U[i][p] ** 2; b += U[i][q] ** 2; g += U[i][p] * U[i][q]; }
      if (Math.abs(g) <= 1e-15 * Math.sqrt(a * b) || g === 0) continue;
      rotated = true;
      const zeta = (b - a) / (2 * g);
      const t = Math.sign(zeta || 1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
      const c = 1 / Math.sqrt(1 + t * t), s = c * t;
      for (let i = 0; i < m; i++) { const up = U[i][p], uq = U[i][q]; U[i][p] = c * up - s * uq; U[i][q] = s * up + c * uq; }
    }
    if (!rotated) break;
  }
  const sv = [];
  for (let j = 0; j < n; j++) { let s = 0; for (let i = 0; i < m; i++) s += U[i][j] ** 2; sv.push(Math.sqrt(s)); }
  return sv.sort((a, b) => b - a);
}
export function cond2(A) { const s = singularValues(A); return s[0] / s[s.length - 1]; }

export function isSymmetric(A, tol = 1e-12) { return A.every((r, i) => r.every((v, j) => Math.abs(v - A[j][i]) <= tol * Math.max(1, Math.abs(v)))); }
export function isSPD(A) { // Cholesky sin pivoteo
  if (!isSymmetric(A)) return false;
  const n = A.length, L = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = A[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
    if (i === j) { if (s <= 0) return false; L[i][i] = Math.sqrt(s); } else L[i][j] = s / L[j][j];
  }
  return true;
}
export function diagDominance(A) {
  const ratios = A.map((r, i) => r.reduce((s, v, j) => s + (j === i ? 0 : Math.abs(v)), 0) / Math.abs(r[i]));
  return { strict: ratios.every((q) => q < 1), maxRatio: Math.max(...ratios) };
}
/** Radio espectral de la matriz de Jacobi T = −D⁻¹(L+U). Para A simétrica con diagonal > 0 es simétrica-semejante. */
export function jacobiSpectralRadius(A) {
  const n = A.length;
  const S = A.map((r, i) => r.map((v, j) => (i === j ? 0 : -v / Math.sqrt(A[i][i] * A[j][j]))));
  const ev = symEigenvalues(S);
  return Math.max(...ev.map(Math.abs));
}

/** Información de convergencia y condición de una matriz de prueba. */
export function systemInfo(A) {
  const spd = isSPD(A), dd = diagDominance(A);
  const ev = spd ? symEigenvalues(A) : null;
  return {
    n: A.length, symmetric: isSymmetric(A), spd, diagDominant: dd.strict, ddRatio: dd.maxRatio,
    cond2: cond2(A), lambdaMin: ev?.[0] ?? null, lambdaMax: ev?.at(-1) ?? null,
    rhoJacobi: spd || isSymmetric(A) ? jacobiSpectralRadius(A) : null,
  };
}

/** Ejecuta un método y registra TODAS las actualizaciones (k, x, residual, error). */
export function runLinear(method, A, b, xStar, { tol = 1e-10, maxIter = 10000 } = {}) {
  const t0 = performance.now();
  const n = b.length, trace = [];
  let x = Array(n).fill(0), r = residualVec(A, x, b);
  const push = (k) => trace.push({ k, approx: x.slice(), residual: normInf(residualVec(A, x, b)), error: normInf(sub(x, xStar)) });
  push(0);
  let converged = false, note = '';
  if (method === 'LU') {
    const f = luFactor(A); x = luSolve(f, b).x; push(1); converged = true; note = `Factorización única (${f.swaps} intercambios de fila).`;
  } else if (method === 'Gradiente conjugado') {
    let p = r.slice(), rs = dot(r, r);
    for (let k = 1; k <= Math.min(maxIter, n * 20); k++) {
      const Ap = matVec(A, p), den = dot(p, Ap);
      if (!(den > 0)) { note = 'pᵀAp ≤ 0: la matriz no es definida positiva.'; break; }
      const alpha = rs / den;
      x = x.map((v, i) => v + alpha * p[i]);
      r = r.map((v, i) => v - alpha * Ap[i]);
      push(k);
      if (trace.at(-1).residual < tol) { converged = true; break; }
      const rsNew = dot(r, r), beta = rsNew / rs;
      p = r.map((v, i) => v + beta * p[i]); rs = rsNew;
      if (!Number.isFinite(rs)) break;
    }
  } else {
    for (let k = 1; k <= maxIter; k++) {
      const next = x.slice();
      for (let i = 0; i < n; i++) {
        let s = 0;
        for (let j = 0; j < n; j++) if (j !== i) s += A[i][j] * (method === 'Gauss-Seidel' && j < i ? next[j] : x[j]);
        next[i] = (b[i] - s) / A[i][i];
      }
      x = next; push(k);
      if (trace.at(-1).residual < tol) { converged = true; break; }
      if (!x.every(Number.isFinite)) { note = 'Divergencia numérica.'; break; }
    }
    if (!converged && !note) note = 'Se alcanzó el máximo de iteraciones.';
  }
  return { method, x, trace, converged, iterations: trace.length - 1, tol, maxIter, timeMs: performance.now() - t0, note };
}
export const LINEAR_METHODS = ['Jacobi', 'Gauss-Seidel', 'LU', 'Gradiente conjugado'];
