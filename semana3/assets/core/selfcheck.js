/** Verificaciones matemáticas independientes (referencias analíticas conocidas). Se usan en la web y en Node. */
import { simulateCase, PRESETS } from '../cases/index.js';
import { runLinear, solveDirect, cond2, systemInfo } from './linear.js';
import { lagrange, newtonInterp, naturalSpline, vandermondeCond } from './interp.js';
import { trapezoid, simpson, romberg } from './integrate.js';
import { integrate } from './ode.js';
import { bisection, newton, secant } from './roots.js';
import { linearMatrix } from '../cases/linear_suite.js';

export function runSelfChecks() {
  const out = [];
  const add = (family, name, expected, got, tol, unit = '') => { const diff = Math.abs(expected - got); out.push({ family, name, expected, got, diff, tol, unit, ok: Number.isFinite(diff) && diff <= tol * Math.max(1, Math.abs(expected)) }); };
  const R = (c, s) => simulateCase(c, s, PRESETS[c][s]);
  // Caso 1
  add('Caso 1', 'd_total NORMAL = v₀tᵣ + v₀²/2a', 40, R(1, 'NORMAL').metric.value, 1e-12, 'm');
  add('Caso 1', 'd_total ESTRÉS', 105, R(1, 'ESTRÉS').metric.value, 1e-12, 'm');
  const rk = integrate(2, (_t, y) => [y[1], -2], [0, 10], 5, 1).rows.at(-1); add('Caso 1', 'RK2 h=1: x(5) = 25 m', 25, rk[1], 1e-12, 'm');
  add('Caso 1', 'RK2 primer paso: x(1) = 9 m', 9, integrate(2, (_t, y) => [y[1], -2], [0, 10], 1, 1).rows[1][1], 1e-12, 'm');
  add('Caso 1', 'Trapecio compuesto de v(t)', 25, trapezoid((t) => 10 - 2 * t, 0, 5, 5), 1e-12, 'm');
  add('Caso 1', 'Perturbación raíz triple: g−10⁻³ → t ≈ 4.7679', 4.7679, bisection((t) => 10 * (1 - t / 5) ** 3 - 1e-3, 0, 7, { tol: 1e-14 }).root, 1e-4, 's');
  // Caso 2
  add('Caso 2', 't* NORMAL (fórmula cuadrática)', 15.8480037854, R(2, 'NORMAL').metric.value, 1e-9, 'meses');
  add('Caso 2', 't* ESTRÉS', 6.32904643145, R(2, 'ESTRÉS').metric.value, 1e-9, 'meses');
  const g = (t) => 0.0001 * t * t + 0.0205 * t - 0.35;
  add('Caso 2', 'Newton desde 15: t₁ = 15.8510638298', 15.8510638298, newton(g, (t) => 0.0205 + 0.0002 * t, 15, { maxIter: 1, tol: 0 }).root, 1e-9, 'meses');
  add('Caso 2', 'Secante converge a t*', 15.8480037854, secant(g, 0, 22, { tol: 1e-13 }).root, 1e-9, 'meses');
  // Sistemas lineales
  const { A, b } = linearMatrix('NORMAL');
  add('Sistemas', 'κ₂(A) NORMAL ≈ 2.608719', 2.608719, cond2(A), 1e-6);
  add('Sistemas', 'κ₂(A) ESTRÉS ≈ 9.255991', 9.255991, cond2(linearMatrix('ESTRÉS').A), 1e-6);
  add('Sistemas', 'κ₂(A) MAL CONDICIONADO = 10⁶', 1e6, cond2(linearMatrix('MAL CONDICIONADO').A), 1e-9);
  add('Sistemas', 'Gradiente conjugado: 4 pasos (NORMAL)', 4, runLinear('Gradiente conjugado', A, b, [1, 2, 3, 4]).iterations, 0);
  add('Sistemas', 'CG: primer paso α₀ = 0.191489362', 0.191489362, (() => { const r = b, Ap = A.map((row) => row.reduce((s, v, i) => s + v * r[i], 0)); return r.reduce((s, v) => s + v * v, 0) / r.reduce((s, v, i) => s + v * Ap[i], 0); })(), 1e-8);
  for (const m of ['Jacobi', 'Gauss-Seidel', 'LU', 'Gradiente conjugado']) add('Sistemas', `${m} recupera x* = (1,2,3,4)`, 0, runLinear(m, A, b, [1, 2, 3, 4]).trace.at(-1).error, 1e-9);
  add('Sistemas', 'Referencia directa recupera x*', 0, Math.max(...solveDirect(A, b).map((v, i) => Math.abs(v - [1, 2, 3, 4][i]))), 1e-12);
  add('Sistemas', 'Jacobi: 31 actualizaciones (NORMAL)', 31, runLinear('Jacobi', A, b, [1, 2, 3, 4]).iterations, 0);
  add('Sistemas', 'Gauss-Seidel: 16 actualizaciones (NORMAL)', 16, runLinear('Gauss-Seidel', A, b, [1, 2, 3, 4]).iterations, 0);
  const lm = linearMatrix('MAL CONDICIONADO'); const xp = solveDirect(lm.A, lm.b.map((v, i) => v + (i === 3 ? 1e-6 : 0)));
  add('Sistemas', 'Perturbación δb=10⁻⁶ → x₄ = 2', 2, xp[3], 1e-9);
  // Caso 3
  add('Caso 3', 'Amplitud NORMAL = x₀ = 0.1 m', 0.1, R(3, 'NORMAL').metric.value, 1e-12, 'm');
  add('Caso 3', 'Máx. |x| ESTRÉS ≈ 0.212435 m', 0.212435, R(3, 'ESTRÉS').metric.value, 1e-6, 'm');
  add('Caso 3', 'ωd = ω₀√(1−ζ²) = 1.959592', 1.959592, 2 * Math.sqrt(1 - 0.04), 1e-6, 'rad/s');
  const e3 = R(3, 'NORMAL').summary; add('Caso 3', 'Error RK4 < 3×10⁻⁶ m (h=0.1)', 0, Math.min(Number(R(3, 'NORMAL').runs[1].summary.metrics.error_max) < 3e-6 ? 0 : 1, 1), 0);
  // Caso 4
  const xs = [0, 0.5, 1.5, 2], ys = xs.map(Math.sin);
  add('Caso 4', 'Lagrange P₃(0.75) = 0.675931992', 0.675931992, lagrange(xs, ys, 0.75), 1e-8);
  add('Caso 4', 'Newton P₃(0.75) = Lagrange', lagrange(xs, ys, 0.75), newtonInterp(xs, ys, 0.75), 1e-13);
  add('Caso 4', 'Spline natural S(0.75) = 0.682819205', 0.682819205, naturalSpline(xs, ys).evalAt(0.75), 1e-8);
  add('Caso 4', 'Spline: M₁ = −0.47091024', -0.47091024, naturalSpline(xs, ys).M[1], 1e-8);
  add('Caso 4', 'κ₂ Vandermonde (0;.001;.002;.003) ≈ 1.4907×10⁹', 1.4907e9, vandermondeCond([0, 0.001, 0.002, 0.003]), 1e-4);
  add('Caso 4', 'κ₂ escalado ≈ 98.868', 98.868, vandermondeCond([0, 1 / 3, 2 / 3, 1]), 1e-4);
  // Integración
  add('Integración', 'Simpson integra x³ en [0,2] exactamente', 4, simpson((t) => t ** 3, 0, 2, 4), 1e-12);
  add('Integración', 'Romberg de sen en [0,π] = 2', 2, romberg(Math.sin, 0, Math.PI, 6).value, 1e-9);
  add('Integración', 'Trapecio de t² (n=100) ≈ 1/3', 1 / 3, trapezoid((t) => t * t, 0, 1, 100), 1e-4);
  return out;
}
