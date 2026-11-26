/** Caso 2 · Deterioro mecánico y mantenimiento (índice D(t) = D₀ + αt + βt²). */
import { relSensitivity, rng, gauss, stats, histogram, nfmt, normInf, sub, errorSet } from '../core/errors.js';
import { bisection, newton, secant, estimateOrder } from '../core/roots.js';
import { trapezoid, simpson, romberg } from '../core/integrate.js';
import { runLinear, solveDirect, luFactor, luSolve, matMul, transpose, cond2, residualVec } from '../core/linear.js';
import { p, makeRun, traceIterations, thin, samples, series, safeLog, tbl, sec, errorRow } from './common.js';
import { linearSuite } from './linear_suite.js';

export const meta = {
  id: 2, name: 'Deterioro mecánico y mantenimiento', short: 'Deterioro', icon: 'tool', unit: 'meses',
  description: 'Instante en que un índice hipotético de deterioro alcanza un umbral de inspección.',
  methods: 'Bisección · Newton · secante · Jacobi · Gauss-Seidel · LU · gradiente conjugado',
  model: 'D(t) = D₀ + αt + βt²;  g(t) = D(t) − D_umbral = 0',
};
export const params = [
  p('D0', 'Deterioro inicial D₀', 'índice', 0, 0.99, 0.001), p('alpha', 'Tasa lineal α', 'mes⁻¹', 0, 0.5, 0.00001), p('beta', 'Tasa cuadrática β', 'mes⁻²', 0, 0.1, 0.000001),
  p('threshold', 'Umbral preventivo', 'índice', 0.01, 1, 0.01), p('tMax', 'Extremo del intervalo [0, tMax]', 'meses', 1, 600, 1), p('x0', 'Semilla de Newton x₀', 'meses', 0, 600, 0.5),
  p('tInsp', 'Intervalo entre inspecciones', 'meses', 1, 120, 1), p('sigma', 'Ruido de las observaciones σ', 'índice', 0, 0.2, 0.001),
  { key: 'scaled', label: 'Calibración con tiempo escalado', unit: '', type: 'select', options: [[1, 'Sí (τ = t/t_max)'], [0, 'No (t en meses)']] },
];
export const presets = {
  'NORMAL': { D0: 0.05, alpha: 0.0205, beta: 0.0001, threshold: 0.4, tMax: 22, x0: 10, tInsp: 12, sigma: 0.002, scaled: 1 },
  'ESTRÉS': { D0: 0.05, alpha: 0.05125, beta: 0.00064, threshold: 0.4, tMax: 12, x0: 4, tInsp: 12, sigma: 0.005, scaled: 1 },
  'MAL CONDICIONADO': { D0: 0.05, alpha: 0.0205, beta: 0.0001, threshold: 0.4, tMax: 22, x0: 10, tInsp: 12, sigma: 0.002, scaled: 0 },
};
export function validate(pr) {
  if (!(pr.threshold > pr.D0)) throw Error('El umbral debe ser mayor que el deterioro inicial.');
  if (!(pr.alpha > 0 || pr.beta > 0)) throw Error('α o β debe ser positivo para alcanzar el umbral.');
  const T = tStar(pr);
  if (!(pr.tMax > T)) throw Error(`tMax debe ser mayor que t* ≈ ${nfmt(T, 4)} meses para encerrar la raíz.`);
}
export const tStar = (q) => { const d = q.threshold - q.D0; return (2 * d) / (q.alpha + Math.sqrt(q.alpha * q.alpha + 4 * q.beta * d)); };

/** Ajuste cúbico por mínimos cuadrados: ecuaciones normales XᵀX c = Xᵀy (SPD 4×4). */
function calibrate(pr, scenario) {
  const D = (t) => pr.D0 + pr.alpha * t + pr.beta * t * t, tObs = Array.from({ length: 21 }, (_, i) => i);
  const rand = rng(777), yObs = tObs.map((t) => D(t) + pr.sigma * gauss(rand));
  const scale = pr.scaled ? 20 : 1;
  const X = tObs.map((t) => [1, t / scale, (t / scale) ** 2, (t / scale) ** 3]);
  const XtX = matMul(transpose(X), X), Xty = transpose(X).map((row) => row.reduce((s, v, i) => s + v * yObs[i], 0));
  const cRef = solveDirect(XtX, Xty), kappa = cond2(XtX), kappaX = cond2(X);
  const runs = ['LU', 'Gradiente conjugado', 'Gauss-Seidel'].map((m) => runLinear(m, XtX, Xty, cRef, { tol: 1e-10 * Math.max(1, normInf(Xty)), maxIter: 20000 }));
  const toPoly = (c) => ({ D0: c[0], alpha: c[1] / scale, beta: c[2] / scale ** 2, c3: c[3] / scale ** 3 });
  const quad = toPoly(cRef);
  const fitD = (t) => cRef[0] + cRef[1] * (t / scale) + cRef[2] * (t / scale) ** 2 + cRef[3] * (t / scale) ** 3;
  let tFit = null;
  try { tFit = newton((t) => fitD(t) - pr.threshold, (t) => (cRef[1] + 2 * cRef[2] * (t / scale) + 3 * cRef[3] * (t / scale) ** 2) / scale, pr.x0, { tol: 1e-12 }); } catch { /* sin raíz */ }
  return { tObs, yObs, XtX, Xty, cRef, kappa, kappaX, runs, quad, fitD, tFit, scale, D };
}

export function simulate(scenario, pr) {
  const { D0, alpha, beta, threshold, tMax, x0, tInsp } = pr;
  const mal = scenario === 'MAL CONDICIONADO';
  const T = tStar(pr), D = (t) => D0 + alpha * t + beta * t * t, g = (t) => D(t) - threshold, gp = (t) => alpha + 2 * beta * t;
  const runs = [], sections = [];

  /* ---------- Raíces ---------- */
  const bis = bisection(g, 0, tMax, { tol: 1e-10, ref: T }), nw = newton(g, gp, x0, { tol: 1e-12, ref: T }), sc = secant(g, 0, tMax, { tol: 1e-12, ref: T });
  const roots = [bis, nw, sc];
  for (const r of roots) runs.push(makeRun({ family: 'Raíces', method: r.method, tolerance: r.tol, maxIter: r.maxIter, converged: r.converged, timeMs: r.timeMs, iterations: traceIterations(r.trace, T), reference: `t* (fórmula cuadrática) = ${nfmt(T, 10)} meses`, value: r.root, unit: 'meses', metrics: { error_abs: Math.abs(r.root - T), residual: Math.abs(g(r.root)), iteraciones: r.iterations }, interpretation: 'Cruce del umbral D(t)=D_umbral.' }));
  const rootRows = roots.map((r) => [r.method, r.seed, r.iterations, nfmt(r.root, 10), nfmt(Math.abs(g(r.root))), nfmt(Math.abs(r.root - T)), r.method === 'Bisección' ? '1 (lineal)' : nfmt(estimateOrder(r.trace)), r.converged ? 'Sí' : 'No']);
  const manual = bis.trace.slice(0, 3).map((t) => [t.k, nfmt(t.approx, 8), nfmt(g(t.approx), 8), `[${nfmt(t.interval[0], 6)}, ${nfmt(t.interval[1], 6)}]`]);
  const rootPlot = { title: 'Convergencia de métodos de raíces', xLabel: 'Iteración', yLabel: 'Residual |D(t) − umbral|', logY: true,
    series: roots.map((r) => series(r.method, thin(r.trace.map((t) => [t.k, safeLog(t.residual)]), 120), r.trace.length < 10 ? { markers: true } : {})) };
  const horizon = Math.max(tMax, T * 1.3);
  const detPlot = { title: 'Evolución del deterioro sintético y umbral', xLabel: 'Tiempo equivalente (meses)', yLabel: 'Índice D(t)', series: [series('D(t)', samples(0, horizon, 100, D)), series('Umbral', [[0, threshold], [horizon, threshold]]), series('t*', [[T, 0], [T, threshold]], { dashed: true })] };
  sections.push(sec('raices', 'Raíces · cruce del umbral D(t) = D_umbral',
    `Forma estable de la raíz positiva: t* = 2(D_u − D₀)/[α + √(α² + 4β(D_u − D₀))] = ${nfmt(T, 10)} meses. La otra raíz es negativa y se descarta (t ≥ 0).`,
    [tbl('Comparación de métodos de raíces', ['Método', 'Semillas', 'Iteraciones', 'Raíz (meses)', 'Residual |g|', 'Error abs.', 'Orden obs.', 'Convergió'], rootRows, `Intervalo [0, ${tMax}], criterios |g| < 10⁻¹⁰ (bisección) y < 10⁻¹² (Newton/secante). Bisección cuenta los puntos medios evaluados; Newton las actualizaciones desde x₀; secante los índices desde las semillas.`),
     tbl('Primeras iteraciones de bisección (cálculo manual reproducible)', ['k', 'Punto medio', 'g(punto medio)', 'Intervalo vigente'], manual),
     tbl('Primeras iteraciones de Newton y secante', ['Método', 'k', 'Estimación (meses)', '|g(t)|', 'Error'], [...nw.trace.slice(0, 4), ...sc.trace.slice(0, 5)].map((t, i) => [i < Math.min(4, nw.trace.length) ? 'Newton-Raphson' : 'Secante', t.k, nfmt(t.approx, 10), nfmt(t.residual), nfmt(t.error)]))],
    [detPlot, rootPlot]));

  /* ---------- Sistemas lineales SPD (referencia del informe) ---------- */
  const lin = linearSuite(scenario);
  runs.push(...lin.dbRuns);
  const linTables = [lin.summaryTable, lin.conv, lin.iterTable];
  if (lin.perturbation) linTables.push(tbl('Perturbación explícita de datos (MAL CONDICIONADO)', ['Magnitud', 'Valor'], [
    ['δb', '(0, 0, 0, 10⁻⁶)'], ['‖δb‖∞/‖b‖∞', nfmt(lin.perturbation.relB)], ['x* → x_pert', '(1,1,1,1) → (' + lin.perturbation.xPert.map((v) => nfmt(Number(v.toFixed(6)))).join(', ') + ')'],
    ['‖δx‖∞/‖x*‖∞', nfmt(lin.perturbation.relX)], ['Amplificación observada', nfmt(lin.perturbation.relX / lin.perturbation.relB)], ['κ₂(A)', nfmt(lin.info.cond2)]],
    'Jacobi y Gauss-Seidel convergen en una actualización por ser diagonal: lentitud de convergencia y mal condicionamiento NO son sinónimos.'));
  sections.push(sec('sistemas', 'Sistemas lineales SPD 4×4 · Jacobi, Gauss-Seidel, LU y gradiente conjugado',
    `Matriz ${lin.label}. Se fija x* conocido, b = A x* y x⁽⁰⁾ = 0; parada ‖b−Ax⁽ᵏ⁾‖∞ < 10⁻¹⁰ (máx. 10 000 iteraciones). La solución directa (eliminación con pivoteo) sirve de segunda referencia.`,
    linTables, [lin.plot]));

  /* ---------- Calibración por mínimos cuadrados (aplicación del caso) ---------- */
  const cal = calibrate(pr, scenario);
  for (const r of cal.runs) runs.push(makeRun({ family: 'Sistemas lineales', method: `Calibración · ${r.method}`, tolerance: r.tol, maxIter: r.maxIter, converged: r.converged, timeMs: r.timeMs,
    iterations: r.trace.map((t) => ({ k: t.k, approx: t.approx, residual: t.residual, error_abs: t.error })), reference: 'Solución directa de XᵀX c = Xᵀy', value: r.x, metrics: { kappa2_normales: cal.kappa, error_inf: normInf(sub(r.x, cal.cRef)) }, interpretation: 'Ecuaciones normales del ajuste cúbico (SPD).' }));
  const calRows = cal.runs.map((r) => [r.method, r.iterations, nfmt(normInf(residualVec(cal.XtX, r.x, cal.Xty))), nfmt(normInf(sub(r.x, cal.cRef))), r.converged ? 'Sí' : 'No']);
  const q = cal.quad;
  const calPlot = { title: 'Calibración: observaciones, ajuste cúbico y modelo verdadero', xLabel: 'Tiempo (meses)', yLabel: 'Índice D(t)',
    series: [series('Modelo verdadero', samples(0, 20, 80, D)), series('Ajuste cúbico', samples(0, 20, 80, cal.fitD)), series('Observaciones', cal.tObs.map((t, i) => [t, cal.yObs[i]]), { scatter: true })] };
  sections.push(sec('calibracion', 'Calibración de coeficientes (ecuaciones normales 4×4)',
    `Se simulan 21 observaciones mensuales (t = 0…20) D(tᵢ) + σ·ε (σ = ${pr.sigma}, semilla fija) y se ajusta c₀ + c₁τ + c₂τ² + c₃τ³ con τ = ${pr.scaled ? 't/20' : 't (sin escalar)'}. Las ecuaciones normales XᵀX c = Xᵀy forman un sistema SPD de orden 4.`,
    [tbl('Condicionamiento y métodos', ['Método', 'Pasos', '‖Xᵀy − XᵀXc‖∞', '‖c − c_dir‖∞', 'Convergió'], calRows, `κ₂(X) = ${nfmt(cal.kappaX, 5)} y κ₂(XᵀX) = ${nfmt(cal.kappa, 5)} (≈ κ₂(X)²). ${pr.scaled ? 'El escalado τ = t/20 mantiene κ moderado.' : 'Sin escalar el sistema normal se degrada: la lentitud de CG/GS y la pérdida de dígitos son efectos del condicionamiento.'}`),
     tbl('Coeficientes recuperados frente al modelo verdadero', ['Coeficiente', 'Verdadero', 'Estimado', 'Eₐ', 'Eᵣ'], [
       ['D₀', nfmt(D0), nfmt(q.D0), nfmt(Math.abs(q.D0 - D0)), nfmt(Math.abs(q.D0 - D0) / Math.abs(D0 || 1))],
       ['α (mes⁻¹)', nfmt(alpha), nfmt(q.alpha), nfmt(Math.abs(q.alpha - alpha)), nfmt(Math.abs(q.alpha - alpha) / alpha)],
       ['β (mes⁻²)', nfmt(beta), nfmt(q.beta), nfmt(Math.abs(q.beta - beta)), nfmt(Math.abs(q.beta - beta) / beta)],
       ['γ cúbico (debería ser 0)', '0', nfmt(q.c3), nfmt(Math.abs(q.c3)), '—'],
       ['t* con el ajuste (meses)', nfmt(T), cal.tFit ? nfmt(cal.tFit.root) : '—', cal.tFit ? nfmt(Math.abs(cal.tFit.root - T)) : '—', cal.tFit ? nfmt(Math.abs(cal.tFit.root - T) / T) : '—']],
       'El ruido se amplifica en los coeficientes de orden alto; la predicción de t* es más estable que los coeficientes individuales.')],
    [calPlot]));

  /* ---------- Integración opcional de la tasa de deterioro ---------- */
  const rate = (t) => alpha + 2 * beta * t, exactInt = threshold - D0;
  const integRows = [2, 4, 8, 16].map((n) => [n, nfmt(trapezoid(rate, 0, T, n)), nfmt(Math.abs(trapezoid(rate, 0, T, n) - exactInt)), nfmt(simpson(rate, 0, T, n)), nfmt(Math.abs(simpson(rate, 0, T, n) - exactInt))]);
  const rb = romberg(rate, 0, T, 5);
  for (const [name, fn] of [['Trapecio compuesto', trapezoid], ['Simpson 1/3 compuesto', simpson]]) runs.push(makeRun({ family: 'Integración', method: name, step: T / 16, maxIter: 16, iterations: [2, 4, 8, 16].map((n) => ({ k: n, approx: fn(rate, 0, T, n), error_abs: Math.abs(fn(rate, 0, T, n) - exactInt), error_rel: Math.abs(fn(rate, 0, T, n) - exactInt) / exactInt })), reference: `D(t*) − D₀ = ${nfmt(exactInt)}`, value: fn(rate, 0, T, 16), metrics: { error_abs: Math.abs(fn(rate, 0, T, 16) - exactInt) }, interpretation: 'Integración opcional de la tasa de deterioro.' }));
  runs.push(makeRun({ family: 'Integración', method: 'Romberg', maxIter: 5, iterations: rb.table.map((r, i) => ({ k: i, approx: r.at(-1), error_abs: Math.abs(r.at(-1) - exactInt), error_rel: Math.abs(r.at(-1) - exactInt) / exactInt })), reference: `D(t*) − D₀ = ${nfmt(exactInt)}`, value: rb.value, metrics: { error_abs: Math.abs(rb.value - exactInt) }, interpretation: 'Integración opcional de la tasa de deterioro.' }));
  sections.push(sec('integracion', 'Integración opcional · deterioro acumulado', 'La integral de la tasa D′(t) = α + 2βt entre 0 y t* debe igualar D_umbral − D₀. Como D′ es lineal, trapecio y Simpson son exactos salvo redondeo.',
    [tbl('Deterioro acumulado ∫₀^{t*} D′(t) dt', ['n', 'Trapecio', 'Error', 'Simpson', 'Error'], integRows, `Referencia D_umbral − D₀ = ${nfmt(exactInt)}. Romberg: ${nfmt(rb.value, 12)}.`)], []));

  /* ---------- Sensibilidad, mantenimiento retrasado y Monte Carlo ---------- */
  const sens = ['alpha', 'beta', 'D0', 'threshold'].map((k) => { const s = relSensitivity(tStar, pr, k, 0.01); return [{ alpha: 'α', beta: 'β', D0: 'D₀', threshold: 'D_umbral' }[k], nfmt(s.base, 8), nfmt(s.pert, 8), nfmt(s.delta, 6), nfmt(s.amplification, 4)]; });
  const delays = [0, 1, 2, 4, 6, 12].map((d) => [d, nfmt(T + d, 6), nfmt(D(T + d), 6), nfmt(D(T + d) - threshold, 6), nfmt(100 * (D(T + d) - threshold) / threshold, 4) + ' %']);
  const firstInsp = Math.ceil(T / tInsp) * tInsp;
  const rand = rng(20261112), N = 2000, ts = [];
  for (let i = 0; i < N; i++) {
    const a2 = Math.max(1e-6, alpha * (1 + 0.1 * gauss(rand))), b2 = Math.max(0, beta * (1 + 0.15 * gauss(rand)));
    ts.push(tStar({ ...pr, alpha: a2, beta: b2 }));
  }
  const st = stats(ts), pFirst = ts.filter((t) => t < tInsp).length / N, pSecond = ts.filter((t) => t < 2 * tInsp).length / N;
  const histo = histogram(ts, 24);
  sections.push(sec('errores', 'Errores, sensibilidad y mantenimiento retrasado',
    'Sensibilidad paramétrica del modelo (no es error del algoritmo), efecto hipotético de retrasar una inspección y propagación estocástica de α y β con semilla fija.',
    [tbl('Errores de los métodos de raíces', ['Método', 'Aproximación (meses)', 'Referencia', 'Eₐ', 'Eᵣ', 'Eₚ'], roots.map((r) => errorRow(r.method, r.root, T))),
     tbl('Sensibilidad de t* ante +1 % en un parámetro', ['Parámetro', 't* base', 't* perturbado', 'Δt* (meses)', 'Amplificación'], sens, 'Amplificación = (Δt*/t*)/(Δp/p). Un valor negativo indica que más deterioro anticipa el umbral.'),
     tbl('Inspección retrasada Δ meses después de t*', ['Δ (meses)', 'Instante', 'D(t)', 'D − umbral', 'Exceso relativo'], delays, `Con inspecciones cada ${tInsp} meses la primera posterior a t* ocurre en t = ${firstInsp} meses (D = ${nfmt(D(firstInsp), 5)}).`),
     tbl(`Monte Carlo (N = ${N}): t* con α ±10 % y β ±15 % (gaussianas)`, ['Estadístico', 'Valor (meses)'], [['Media', nfmt(st.mean)], ['Desv. estándar', nfmt(st.sd)], ['Percentil 5', nfmt(st.p05)], ['Mediana', nfmt(st.p50)], ['Percentil 95', nfmt(st.p95)], [`P(t* < ${tInsp} meses: antes de la 1.ª inspección)`, nfmt(100 * pFirst) + ' %'], [`P(t* < ${2 * tInsp} meses: antes de la 2.ª)`, nfmt(100 * pSecond) + ' %']], 'Incertidumbre sintética; no es una probabilidad de falla real.')],
    [{ title: 'Distribución Monte Carlo del instante de cruce t*', xLabel: 't* (meses)', yLabel: 'Frecuencia relativa', kind: 'bars', series: [series('Frecuencia', histo.map((b) => [b.x, b.share]))], vlines: [{ x: T, label: 't* determinista' }] }]));

  /* ---------- Conclusiones ---------- */
  const numeric = `Bisección (${bis.iterations} puntos medios, convergencia lineal), Newton (${nw.iterations} actualizaciones, orden ≈ ${nfmt(estimateOrder(nw.trace), 3)}) y secante (${sc.iterations}, orden ≈ ${nfmt(estimateOrder(sc.trace), 3)}) convergen a t* = ${nfmt(T, 8)} meses; el error es ${nfmt(Math.abs(nw.root - T))} (Newton). En los sistemas lineales SPD ${lin.runs.map((r) => `${r.method}: ${r.iterations}`).join(', ')} paso(s); κ₂(A) = ${nfmt(lin.info.cond2, 5)}, ρ(T_J) = ${lin.info.rhoJacobi === null ? '—' : nfmt(lin.info.rhoJacobi, 4)}. ${mal ? `El caso MAL CONDICIONADO muestra amplificación ${nfmt(lin.perturbation.relX / lin.perturbation.relB)} ≈ κ₂ sin que ningún método falle; el ajuste sin escalar tiene κ₂(XᵀX) = ${nfmt(cal.kappa, 3)}.` : 'Gradiente conjugado termina en ≤ n pasos (aritmética exacta) y LU en una factorización.'}`;
  const physical = `En el modelo educativo el índice alcanza D = ${threshold} a los ${nfmt(T, 4)} meses; con α +1 % el umbral se adelanta ${nfmt(Math.abs(relSensitivity(tStar, pr, 'alpha', 0.01).delta), 4)} meses. Un retraso de 6 meses en la inspección deja el índice ${nfmt(D(T + 6) - threshold, 4)} por encima del umbral (${nfmt(100 * (D(T + 6) - threshold) / threshold, 3)} %). La incertidumbre de α y β desplaza t* entre ${nfmt(st.p05, 4)} y ${nfmt(st.p95, 4)} meses (P5–P95). Los valores no constituyen un calendario real de mantenimiento ni un diagnóstico mecánico.`;
  const summary = [
    { label: 'Tiempo al umbral t*', value: nfmt(T, 6), unit: 'meses' }, { label: 'Umbral sintético', value: nfmt(threshold), unit: 'índice' },
    { label: 'κ₂ de la matriz SPD', value: nfmt(lin.info.cond2, 5), unit: '' }, { label: 'Métodos de calibración', value: '4 + ajuste', unit: '' },
    { label: 'Exceso con 6 meses de retraso', value: nfmt(D(T + 6) - threshold, 4), unit: 'índice' }, { label: 'Percentiles P5–P95 de t*', value: `${nfmt(st.p05, 4)}–${nfmt(st.p95, 4)}`, unit: 'meses' },
  ];
  return { summary, sections, runs, metric: { label: 'Tiempo al umbral', value: T, unit: 'meses' }, numeric, physical,
    note: mal ? 'MAL CONDICIONADO: calibración SPD con κ₂ = 10⁶ y ajuste sin escalar; la matriz permanece SPD y no se interpreta como falla mecánica.' : 'Referencia cuadrática; el avance anterior con una EDO exponencial usaba otro modelo y no se mezcla con este.',
    plots: sections.flatMap((s) => s.plots), tables: sections.flatMap((s) => s.tables), extra: { linear: lin, calib: { kappa: cal.kappa, kappaX: cal.kappaX } } };
}
