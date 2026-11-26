/** Caso 1 · Detención de emergencia de cabinas. */
import { errorSet, relSensitivity, rng, stats, histogram, observedOrder, nfmt } from '../core/errors.js';
import { bisection, newton, secant, estimateOrder, linearRatio } from '../core/roots.js';
import { trapezoid, simpson, romberg } from '../core/integrate.js';
import { integrate } from '../core/ode.js';
import { p, makeRun, traceIterations, thin, samples, series, safeLog, tbl, sec, errorRow } from './common.js';

export const meta = {
  id: 1, name: 'Detención de emergencia', short: 'Detención', icon: 'brake', unit: 'm',
  description: 'Tiempo y distancia de frenado frente a cambios de velocidad, reacción y desaceleración.',
  methods: 'RK2 · RK4 · bisección · Newton · secante · trapecio · Simpson · Romberg',
  model: 'v(t) = v₀ − at;  x(t) = v₀t − ½at²;  t_det = v₀/a;  d_fren = v₀²/(2a)',
};
export const params = [
  p('v0', 'Velocidad inicial v₀', 'm/s', 0.1, 80, 0.1), p('a', 'Desaceleración a', 'm/s²', 0.01, 25, 0.01),
  p('tr', 'Tiempo de reacción tᵣ', 's', 0, 20, 0.1), p('h', 'Paso numérico h', 's', 0.01, 5, 0.01),
  p('c', 'Coef. de frenado variable c (ampliación)', '1/s', 0, 2, 0.01), p('dAvail', 'Distancia disponible', 'm', 1, 2000, 1),
];
export const presets = {
  'NORMAL': { v0: 10, a: 2, tr: 1.5, h: 1, c: 0.2, dAvail: 60 },
  'ESTRÉS': { v0: 15, a: 1.5, tr: 2, h: 2, c: 0.2, dAvail: 100 },
  'MAL CONDICIONADO': { v0: 10, a: 2, tr: 1.5, h: 1, c: 0.2, dAvail: 60 },
};
export function validate(pr) {
  if (!(pr.v0 > 0 && pr.a > 0)) throw Error('v₀ y a deben ser positivos.');
}

export function simulate(scenario, pr) {
  const { v0, a, tr, h, c, dAvail } = pr;
  const mal = scenario === 'MAL CONDICIONADO';
  const T = v0 / a, dBrake = (v0 * v0) / (2 * a), dReact = v0 * tr, dTotal = dReact + dBrake;
  const vExact = (t) => Math.max(0, v0 - a * t), xExact = (t) => v0 * Math.min(t, T) - 0.5 * a * Math.min(t, T) ** 2;
  const runs = [], sections = [];

  /* ---------- Raíces: instante v(t)=0 ---------- */
  const g = mal ? (t) => v0 * (1 - t / T) ** 3 : (t) => v0 - a * t;
  const gp = mal ? (t) => (-3 * v0 / T) * (1 - t / T) ** 2 : () => -a;
  const bMax = 1.4 * T, x0 = 0.2 * T;
  const bis = bisection(g, 0, bMax, { tol: 1e-10, ref: T });
  const nw = newton(g, gp, x0, { tol: 1e-12, ref: T });
  const sc = secant(g, 0, bMax, { tol: 1e-12, ref: T });
  const rootRuns = [bis, nw, sc];
  let nwm = null;
  if (mal) nwm = newton(g, gp, x0, { tol: 1e-12, ref: T, multiplicity: 3, name: 'Newton modificado (m=3)' });
  const allRoots = nwm ? [...rootRuns, nwm] : rootRuns;
  for (const r of allRoots) {
    runs.push(makeRun({
      family: 'Raíces', method: r.method, tolerance: r.tol, step: null, maxIter: r.maxIter, converged: r.converged, timeMs: r.timeMs,
      iterations: traceIterations(r.trace, T), reference: `t_det = v₀/a = ${nfmt(T)} s`, value: r.root,
      metrics: { error_abs: Math.abs(r.root - T), residual: Math.abs(g(r.root)), iteraciones: r.iterations }, unit: 's',
      interpretation: mal ? 'Raíz triple: convergencia lineal; el residual es pequeño pero el error en t no.' : 'Raíz simple: convergencia según el orden teórico del método.',
    }));
  }
  const rootRows = allRoots.map((r) => [r.method, r.seed, r.iterations, nfmt(r.root, 10), nfmt(Math.abs(g(r.root))), nfmt(Math.abs(r.root - T)), (r.method === 'Bisección' ? '1 (lineal)' : nfmt(estimateOrder(r.trace))), r.converged ? 'Sí' : 'No']);
  const delta = 1e-3;
  const gPert = (t) => g(t) - delta;
  let pertRow = null;
  try {
    const rr = bisection(gPert, 0, bMax, { tol: 1e-13 });
    pertRow = [mal ? 'Raíz triple' : 'Raíz simple', nfmt(delta), nfmt(rr.root, 8), nfmt(Math.abs(rr.root - T)), nfmt(Math.abs(rr.root - T) / T / (delta / v0))];
  } catch { /* sin cambio de signo */ }
  const rootPlot = { title: 'Convergencia de las raíces', xLabel: 'Iteración', yLabel: 'Error absoluto en t (s)', logY: true,
    series: allRoots.map((r) => series(r.method, thin(r.trace.map((t) => [t.k, safeLog(t.error ?? 0)]), 120), r.trace.length < 8 ? { markers: true } : {})) };
  sections.push(sec('raices', 'Raíces · instante de detención v(t) = 0',
    mal ? 'Subexperimento de sensibilidad: v(t)=v₀(1−t/T)³ tiene una raíz triple en T = v₀/a y g′(T) = 0. NO es una curva física de frenado.'
        : 'Formulación continua g(t) = v₀ − a·t. La referencia analítica es T = v₀/a.',
    [tbl('Comparación de métodos de raíces', ['Método', 'Semillas', 'Iteraciones', 'Raíz (s)', 'Residual |g|', 'Error abs. (s)', 'Orden obs.', 'Convergió'], rootRows,
         `Intervalo [0, ${nfmt(bMax)}]; criterio |g| < 10⁻¹⁰ (bisección) y < 10⁻¹² (Newton/secante).`),
     tbl('Primeras iteraciones registradas', ['Método', 'k', 'Estimación (s)', '|g(t)|', 'Error (s)'],
         allRoots.flatMap((r) => r.trace.slice(0, 5).map((t) => [r.method, t.k, nfmt(t.approx, 10), nfmt(t.residual), nfmt(t.error)]))),
     ...(pertRow ? [tbl('Sensibilidad de la raíz ante g(t) − δ = 0', ['Tipo', 'δ', 'Raíz perturbada (s)', 'Cambio en t (s)', 'Amplificación relativa'], [pertRow],
        mal ? 'Con raíz triple un cambio de 10⁻³ en g desplaza la raíz ≈ 0.23 s; es sensibilidad del modelo de raíz plana, no peligro físico.' : 'Raíz simple: el desplazamiento es δ/a, muy pequeño.')] : [])],
    [rootPlot]));

  /* ---------- EDO: RK2 y RK4 sobre (x, v) ---------- */
  const f = (_t, y) => [y[1], -a];
  const rk2 = integrate(2, f, [0, v0], T, h), rk4 = integrate(4, f, [0, v0], T, h);
  const errX = (rows) => Math.max(...rows.rows.map((r) => Math.abs(r[1] - xExact(r[0])))), errV = (rows) => Math.max(...rows.rows.map((r) => Math.abs(r[2] - vExact(r[0]))));
  for (const [name, res, ord] of [['RK2 (punto medio)', rk2, 2], ['RK4', rk4, 4]]) {
    runs.push(makeRun({
      family: 'EDO', method: name, tolerance: null, step: res.h, maxIter: res.steps, converged: true, timeMs: 0,
      iterations: thin(res.rows.map((r, i) => ({ k: i, approx: [r[1], r[2]], residual: Math.abs(r[2] - vExact(r[0])), error_abs: Math.abs(r[1] - xExact(r[0])), error_rel: xExact(r[0]) ? Math.abs(r[1] - xExact(r[0])) / Math.abs(xExact(r[0])) : null })), 200),
      reference: 'x(t)=v₀t−½at², v(t)=v₀−at', value: [res.rows.at(-1)[1], res.rows.at(-1)[2]],
      metrics: { error_x_max: errX(res), error_v_max: errV(res), orden_teorico: ord },
      interpretation: 'Aceleración constante: x″ es constante, por lo que la regla del punto medio reproduce el polinomio salvo redondeo.', unit: 'm',
    }));
  }
  const rkRows = rk4.rows.map((r, i) => [nfmt(r[0]), nfmt(xExact(r[0])), nfmt(rk2.rows[Math.min(i, rk2.rows.length - 1)][1]), nfmt(r[1]), nfmt(vExact(r[0])), nfmt(r[2])]);
  // Ampliación: desaceleración dependiente de la velocidad  v' = −(a + c v)
  let ext = null;
  if (c > 0) {
    const Tc = Math.log(1 + (c * v0) / a) / c, vC = (t) => (v0 + a / c) * Math.exp(-c * t) - a / c;
    const xC = (t) => ((v0 + a / c) / c) * (1 - Math.exp(-c * t)) - (a / c) * t, dC = xC(Tc);
    const fC = (_t, y) => [y[1], -(a + c * y[1])];
    const hs = [h * 2, h, h / 2, h / 4, h / 8];
    const study = hs.map((hh) => {
      const r2 = integrate(2, fC, [0, v0], Tc, hh), r4 = integrate(4, fC, [0, v0], Tc, hh);
      return { h: r2.h, e2: Math.abs(r2.rows.at(-1)[1] - dC), e4: Math.abs(r4.rows.at(-1)[1] - dC) };
    });
    const rows = study.map((s, i) => [nfmt(s.h), nfmt(s.e2), i ? nfmt(observedOrder(study[i - 1].e2, s.e2)) : '—', nfmt(s.e4), i ? nfmt(observedOrder(study[i - 1].e4, s.e4)) : '—']);
    // raíz de v_C(t)=0 con Newton (formulación continua) y integración de v_C
    const rC = newton(vC, (t) => -c * (v0 + a / c) * Math.exp(-c * t), Tc * 0.3, { tol: 1e-12, ref: Tc });
    const nInt = [2, 4, 8, 16, 32, 64];
    const intStudy = nInt.map((n) => ({ n, tr: trapezoid(vC, 0, Tc, n), sp: simpson(vC, 0, Tc, n) }));
    const rb = romberg(vC, 0, Tc, 7);
    ext = { Tc, dC, study, rows, rC, intStudy, rb, vC, xC };
    runs.push(makeRun({ family: 'EDO', method: 'RK4 · ampliación v′ = −(a + c·v)', tolerance: null, step: study[1].h, maxIter: null, converged: true,
      iterations: study.map((s, i) => ({ k: i, approx: s.h, residual: null, error_abs: s.e4, error_rel: s.e4 / dC })), reference: `d_fren,c = ${nfmt(dC)} m`, value: dC,
      metrics: { orden_observado_rk4: observedOrder(study[2].e4, study[3].e4), orden_observado_rk2: observedOrder(study[2].e2, study[3].e2) }, interpretation: 'Con coeficiente variable los errores muestran el orden real (2 y 4).', unit: 'm' }));
  }
  const odeTables = [
    tbl('Trayectoria: referencia analítica, RK2 y RK4', ['t (s)', 'x exacta (m)', 'x RK2 (m)', 'x RK4 (m)', 'v exacta (m/s)', 'v RK4 (m/s)'], thin(rkRows, 14),
      `h = ${nfmt(rk4.h)} s, ${rk4.steps} pasos hasta t = v₀/a. Errores máximos: RK2 ${nfmt(errX(rk2))} m, RK4 ${nfmt(errX(rk4))} m (solo redondeo).`),
  ];
  if (ext) odeTables.push(tbl(`Ampliación (v′ = −(a + c·v), c = ${c} s⁻¹): error de posición en t_det,c = ${nfmt(ext.Tc)} s`, ['h (s)', 'Error RK2 (m)', 'Orden RK2', 'Error RK4 (m)', 'Orden RK4'], ext.rows,
    `Referencia analítica: d_fren,c = (v₀/c) − (a/c²)·ln(1 + c·v₀/a) = ${nfmt(ext.dC)} m.`));
  const odePlots = [
    { title: 'Velocidad durante el frenado', xLabel: 'Tiempo de frenado (s)', yLabel: 'Velocidad (m/s)',
      series: [series('Referencia analítica', samples(0, T, 80, vExact)), series('RK2', rk2.rows.map((r) => [r[0], r[2]]), { markers: true }), series('RK4', rk4.rows.map((r) => [r[0], r[2]]), { markers: true })] },
    { title: 'Posición durante el frenado', xLabel: 'Tiempo de frenado (s)', yLabel: 'Posición (m)',
      series: [series('Referencia analítica', samples(0, T, 80, xExact)), series('RK2', rk2.rows.map((r) => [r[0], r[1]]), { markers: true }), series('RK4', rk4.rows.map((r) => [r[0], r[1]]), { markers: true })] },
  ];
  if (ext) odePlots.push({ title: 'Ampliación: error vs paso (log-log)', xLabel: 'Paso h (s)', yLabel: 'Error de posición (m)', logX: true, logY: true,
    series: [series('RK2', ext.study.map((s) => [s.h, safeLog(s.e2)]), { markers: true }), series('RK4', ext.study.map((s) => [s.h, safeLog(s.e4)]), { markers: true })] });
  sections.push(sec('edo', 'EDO · dx/dt = v, dv/dt = −a', 'Sistema de primer orden y = (x, v) integrado con RK2 (punto medio, variante declarada) y RK4 clásico.', odeTables, odePlots));

  /* ---------- Integración de v(t) ---------- */
  const nList = [2, 4, 8, 16, 32];
  const integRows = [], integRuns = [];
  const intRef = dBrake;
  for (const n of nList) integRows.push([n, nfmt(trapezoid(vExact, 0, T, n)), nfmt(Math.abs(trapezoid(vExact, 0, T, n) - intRef)), nfmt(simpson(vExact, 0, T, n)), nfmt(Math.abs(simpson(vExact, 0, T, n) - intRef))]);
  const rb0 = romberg(vExact, 0, T, 5);
  const integTables = [
    tbl('Distancia de frenado = ∫₀ᵀ v(t) dt (v lineal)', ['Subintervalos n', 'Trapecio (m)', 'Error trapecio', 'Simpson 1/3 (m)', 'Error Simpson'], integRows, `Referencia v₀²/(2a) = ${nfmt(intRef)} m. El trapecio es exacto para integrandos lineales.`),
    tbl('Romberg sobre v(t)', ['Nivel', ...rb0.table.at(-1).map((_, j) => `R(i,${j})`)], rb0.table.map((r, i) => [i, ...r.map((v) => nfmt(v, 10)), ...Array(rb0.table.at(-1).length - r.length).fill('')])),
  ];
  const integPlots = [];
  runs.push(makeRun({ family: 'Integración', method: 'Trapecio compuesto', tolerance: null, step: T / 32, maxIter: 32, converged: true, iterations: nList.map((n, i) => ({ k: n, approx: trapezoid(vExact, 0, T, n), residual: null, error_abs: Math.abs(trapezoid(vExact, 0, T, n) - intRef), error_rel: Math.abs(trapezoid(vExact, 0, T, n) - intRef) / intRef })), reference: `v₀²/(2a)=${nfmt(intRef)} m`, value: trapezoid(vExact, 0, T, 32), unit: 'm', metrics: { error_abs: Math.abs(trapezoid(vExact, 0, T, 32) - intRef) }, interpretation: 'Exacto para v(t) lineal.' }));
  runs.push(makeRun({ family: 'Integración', method: 'Simpson 1/3 compuesto', tolerance: null, step: T / 32, maxIter: 32, converged: true, iterations: nList.map((n) => ({ k: n, approx: simpson(vExact, 0, T, n), residual: null, error_abs: Math.abs(simpson(vExact, 0, T, n) - intRef), error_rel: Math.abs(simpson(vExact, 0, T, n) - intRef) / intRef })), reference: `v₀²/(2a)=${nfmt(intRef)} m`, value: simpson(vExact, 0, T, 32), unit: 'm', metrics: { error_abs: Math.abs(simpson(vExact, 0, T, 32) - intRef) }, interpretation: 'Exacto para polinomios de grado ≤ 3.' }));
  runs.push(makeRun({ family: 'Integración', method: 'Romberg', tolerance: null, step: T / 16, maxIter: 5, converged: true, iterations: rb0.table.map((r, i) => ({ k: i, approx: r.at(-1), residual: null, error_abs: Math.abs(r.at(-1) - intRef), error_rel: Math.abs(r.at(-1) - intRef) / intRef })), reference: `v₀²/(2a)=${nfmt(intRef)} m`, value: rb0.value, unit: 'm', metrics: { error_abs: Math.abs(rb0.value - intRef) }, interpretation: 'Extrapolación de Richardson sobre el trapecio.' }));
  if (ext) {
    const rows = ext.intStudy.map((s, i) => [s.n, nfmt(s.tr), nfmt(Math.abs(s.tr - ext.dC)), i ? nfmt(observedOrder(Math.abs(ext.intStudy[i - 1].tr - ext.dC), Math.abs(s.tr - ext.dC))) : '—', nfmt(s.sp), nfmt(Math.abs(s.sp - ext.dC)), i ? nfmt(observedOrder(Math.abs(ext.intStudy[i - 1].sp - ext.dC), Math.abs(s.sp - ext.dC))) : '—']);
    integTables.push(tbl(`Ampliación: ∫ v_c(t) dt (integrando exponencial) hasta t = ${nfmt(ext.Tc)} s`, ['n', 'Trapecio', 'Error', 'Orden', 'Simpson', 'Error', 'Orden'], rows, `Referencia analítica ${nfmt(ext.dC)} m. Romberg (7 niveles): ${nfmt(ext.rb.value, 12)} (error ${nfmt(Math.abs(ext.rb.value - ext.dC))}).`));
    integPlots.push({ title: 'Ampliación: error de integración vs n (log-log)', xLabel: 'Subintervalos n', yLabel: 'Error absoluto (m)', logX: true, logY: true,
      series: [series('Trapecio', ext.intStudy.map((s) => [s.n, safeLog(Math.abs(s.tr - ext.dC))]), { markers: true }), series('Simpson 1/3', ext.intStudy.map((s) => [s.n, safeLog(Math.abs(s.sp - ext.dC))]), { markers: true })] });
  }
  sections.push(sec('integracion', 'Integración · distancia de frenado', 'La distancia es la integral de la velocidad. Se comparan trapecio compuesto, Simpson 1/3 compuesto y Romberg con la referencia analítica.', integTables, integPlots));

  /* ---------- Errores, sensibilidad y Monte Carlo ---------- */
  const dTot = (q) => q.v0 * q.tr + (q.v0 * q.v0) / (2 * q.a);
  const sens = ['v0', 'a', 'tr'].map((k) => { const s = relSensitivity(dTot, pr, k, 0.01); const sT = relSensitivity((q) => q.v0 / q.a, pr, k, 0.01); return [k === 'v0' ? 'v₀' : k === 'a' ? 'a' : 'tᵣ', nfmt(s.delta), nfmt(100 * s.relChange) + ' %', nfmt(s.amplification), nfmt(sT.amplification)]; });
  const rand = rng(20261112), N = 2000, sample = [], ts = [];
  for (let i = 0; i < N; i++) {
    const q = { v0: v0 * (0.95 + 0.1 * rand()), a: a * (0.8 + 0.4 * rand()), tr: tr * (0.5 + rand()) };
    sample.push(dTot(q)); ts.push(q.v0 / q.a + q.tr);
  }
  const st = stats(sample), pExceed = sample.filter((v) => v > dAvail).length / N;
  const errTable = tbl('Tabla de errores por método (Eₐ, Eᵣ, Eₚ)', ['Método / magnitud', 'Aproximación', 'Referencia', 'Eₐ', 'Eᵣ', 'Eₚ'], [
    errorRow('Bisección · t_det (s)', bis.root, T), errorRow('Newton · t_det (s)', nw.root, T), errorRow('Secante · t_det (s)', sc.root, T),
    ...(nwm ? [errorRow('Newton modificado · t_det (s)', nwm.root, T)] : []),
    errorRow('RK2 · x(T) (m)', rk2.rows.at(-1)[1], dBrake), errorRow('RK4 · x(T) (m)', rk4.rows.at(-1)[1], dBrake),
    errorRow('Trapecio n=32 · d_fren (m)', trapezoid(vExact, 0, T, 32), dBrake), errorRow('Simpson n=32 · d_fren (m)', simpson(vExact, 0, T, 32), dBrake), errorRow('Romberg · d_fren (m)', rb0.value, dBrake),
  ]);
  const histo = histogram(sample, 24);
  sections.push(sec('errores', 'Errores, sensibilidad y análisis estadístico',
    'Teoría de errores transversal: errores por método, sensibilidad relativa (amplificación ≈ variación relativa del resultado / variación relativa del dato) y propagación estocástica con semilla fija (reproducible).',
    [errTable,
     tbl('Sensibilidad de d_total y t_det ante +1 % en un parámetro', ['Parámetro', 'Δ d_total (m)', 'Δ d_total (%)', 'Amplificación d_total', 'Amplificación t_det'], sens, 'Amplificación = (Δy/y)/(Δp/p). La distancia total suma un término lineal en v₀ (reacción) y uno cuadrático (frenado, ∝ v₀²), por eso la amplificación respecto de v₀ queda entre 1 y 2.'),
     tbl(`Monte Carlo (N = ${N}, semilla 20261112): distribución de d_total`, ['Estadístico', 'Valor (m)'], [['Media', nfmt(st.mean)], ['Desv. estándar', nfmt(st.sd)], ['Percentil 5', nfmt(st.p05)], ['Mediana', nfmt(st.p50)], ['Percentil 95', nfmt(st.p95)], ['Máximo', nfmt(st.max)], [`P(d_total > ${dAvail} m)`, nfmt(100 * pExceed) + ' %']],
       'Incertidumbres sintéticas: v₀ ±5 %, a ±20 %, tᵣ ±50 % (distribuciones uniformes). Ilustra propagación, no mide un riesgo real.')],
    [{ title: 'Distribución Monte Carlo de la distancia total', xLabel: 'Distancia total (m)', yLabel: 'Frecuencia relativa', kind: 'bars', series: [series('Frecuencia', histo.map((b) => [b.x, b.share]))], vlines: [{ x: dAvail, label: 'Distancia disponible' }, { x: dTotal, label: 'Determinista' }] }]));

  /* ---------- Resúmenes y conclusiones ---------- */
  const margin = pr.dAvail - dTotal;
  const summary = [
    { label: 'Tiempo de frenado', value: nfmt(T), unit: 's' }, { label: 'Distancia de frenado', value: nfmt(dBrake), unit: 'm' },
    { label: 'Distancia de reacción', value: nfmt(dReact), unit: 'm' }, { label: 'Distancia total', value: nfmt(dTotal), unit: 'm' },
    { label: 'Margen con la distancia disponible', value: nfmt(margin), unit: 'm' }, { label: 'P(d > disponible) Monte Carlo', value: nfmt(100 * pExceed), unit: '%' },
  ];
  const numeric = mal
    ? `La raíz triple de v₀(1−t/T)³ hace que Newton y la secante pasen de convergencia superlineal/cuadrática a lineal (razón ≈ ${nfmt(linearRatio(nw.trace))}); el error en t tras ${nw.iterations} iteraciones de Newton es ${nfmt(Math.abs(nw.root - T))} s aunque el residual sea ${nfmt(Math.abs(g(nw.root)))}. El Newton modificado (m = 3) recupera convergencia en ${nwm.iterations} paso(s). Bisección no depende de la derivada pero converge solo linealmente (÷2 por paso). Esto es mal condicionamiento de la raíz, no falta de convergencia ni peligro físico.`
    : `Con a constante, RK2 y RK4 reproducen x(t) salvo redondeo (error máx. ${nfmt(Math.max(errX(rk2), errX(rk4)))} m). Newton y secante hallan T = v₀/a en ${nw.iterations} y ${sc.iterations} iteraciones (función lineal), la bisección requiere ${bis.iterations}. En la ampliación v′ = −(a + c·v) los órdenes observados son ≈ ${ext ? nfmt(observedOrder(ext.study[2].e2, ext.study[3].e2), 3) : '2'} (RK2) y ≈ ${ext ? nfmt(observedOrder(ext.study[2].e4, ext.study[3].e4), 3) : '4'} (RK4). Trapecio y Simpson integran v(t) lineal sin error; el orden real aparece con el integrando exponencial.`;
  const physical = `Con los parámetros sintéticos la cabina necesita ${nfmt(T)} s y ${nfmt(dBrake)} m para detenerse tras frenar, más ${nfmt(dReact)} m durante la reacción (total ${nfmt(dTotal)} m). ${margin >= 0 ? `Queda un margen de ${nfmt(margin)} m respecto de la distancia disponible declarada` : `La distancia disponible declarada se excede en ${nfmt(-margin)} m`}; la propagación Monte Carlo estima P(d_total > ${dAvail} m) ≈ ${nfmt(100 * pExceed)} %. La distancia crece con v₀² y con tᵣ; la desaceleración influye como 1/a. No se infieren distancias ni protocolos reales de seguridad.`;
  const note = mal ? 'MAL CONDICIONADO es aquí un subexperimento de raíces (multiplicidad 3); las tablas de EDO e integración usan el modelo lineal base.' : 'Parámetros sintéticos y supuestos; sin relación con equipos reales de Mi Teleférico.';
  return { summary, sections, runs, metric: { label: 'Distancia total', value: dTotal, unit: 'm' }, numeric, physical, note,
    plots: sections.flatMap((s) => s.plots), tables: sections.flatMap((s) => s.tables) };
}
