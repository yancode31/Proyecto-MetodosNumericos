/** Interpolación: Lagrange, Newton por diferencias divididas, spline cúbico natural, nodos de Chebyshev. */
import { singularValues, solveDirect, luFactor, luSolve } from './linear.js';

export function lagrangeBasis(xs, t) {
  return xs.map((x, i) => { let li = 1; for (let j = 0; j < xs.length; j++) if (j !== i) li *= (t - xs[j]) / (x - xs[j]); return li; });
}
export function lagrange(xs, ys, t) { return lagrangeBasis(xs, t).reduce((s, l, i) => s + l * ys[i], 0); }

/** Tabla de diferencias divididas (columna j = diferencias de orden j). */
export function dividedDifferences(xs, ys) {
  const n = xs.length, table = [ys.slice()];
  for (let j = 1; j < n; j++) {
    const prev = table[j - 1], col = [];
    for (let i = 0; i < n - j; i++) col.push((prev[i + 1] - prev[i]) / (xs[i + j] - xs[i]));
    table.push(col);
  }
  return { table, coef: table.map((c) => c[0]) };
}
export function newtonEval(xs, coef, t) { let r = coef.at(-1); for (let j = coef.length - 2; j >= 0; j--) r = r * (t - xs[j]) + coef[j]; return r; }
export function newtonInterp(xs, ys, t) { return newtonEval(xs, dividedDifferences(xs, ys).coef, t); }

/** Spline cúbico natural con M_i = S''(x_i). Resuelve el sistema tridiagonal interno con Thomas. */
export function naturalSpline(xs, ys) {
  const n = xs.length, h = Array.from({ length: n - 1 }, (_, i) => xs[i + 1] - xs[i]);
  const m = n - 2, rhs = [], diag = [], low = [], up = [];
  for (let i = 1; i <= m; i++) {
    diag.push(2 * (h[i - 1] + h[i]));
    low.push(h[i - 1]); up.push(h[i]);
    rhs.push(6 * ((ys[i + 1] - ys[i]) / h[i] - (ys[i] - ys[i - 1]) / h[i - 1]));
  }
  // sistema reducido (forma del informe: dividir entre 2 (h) cuando h uniforme no es necesario)
  const M = Array(n).fill(0);
  if (m > 0) {
    const c = Array(m).fill(0), d = Array(m).fill(0);
    c[0] = up[0] / diag[0]; d[0] = rhs[0] / diag[0];
    for (let i = 1; i < m; i++) {
      const den = diag[i] - low[i] * c[i - 1];
      c[i] = up[i] / den; d[i] = (rhs[i] - low[i] * d[i - 1]) / den;
    }
    const sol = Array(m).fill(0); sol[m - 1] = d[m - 1];
    for (let i = m - 2; i >= 0; i--) sol[i] = d[i] - c[i] * sol[i + 1];
    for (let i = 0; i < m; i++) M[i + 1] = sol[i];
  }
  const evalAt = (t) => {
    let i = 0; while (i < n - 2 && t > xs[i + 1]) i++;
    const hi = h[i], A = (xs[i + 1] - t) / hi, B = (t - xs[i]) / hi;
    return A * ys[i] + B * ys[i + 1] + ((A ** 3 - A) * M[i] + (B ** 3 - B) * M[i + 1]) * hi * hi / 6;
  };
  const reduced = { A: Array.from({ length: m }, (_, i) => Array.from({ length: m }, (_, j) => (i === j ? diag[i] : j === i - 1 ? low[i] : j === i + 1 ? up[i] : 0))), b: rhs };
  return { M, h, evalAt, reduced };
}

export const chebyshevNodes = (a, b, n) => Array.from({ length: n }, (_, k) => 0.5 * (a + b) + 0.5 * (b - a) * Math.cos(((2 * k + 1) * Math.PI) / (2 * n))).sort((p, q) => p - q);
export const uniformNodes = (a, b, n) => Array.from({ length: n }, (_, k) => a + ((b - a) * k) / (n - 1));

export const vandermonde = (xs) => xs.map((x) => xs.map((_, j) => x ** j));
export function vandermondeCond(xs) { const s = singularValues(vandermonde(xs)); return s[0] / s.at(-1); }
/** Coeficientes monomiales por solución directa (LU con pivoteo) de V c = y. */
export function monomialCoeffs(xs, ys) { return luSolve(luFactor(vandermonde(xs)), ys).x; }
export function polyEval(c, t) { return c.reduceRight((s, v) => s * t + v, 0); }
