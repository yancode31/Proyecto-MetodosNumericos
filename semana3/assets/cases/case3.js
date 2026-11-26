/** Caso 3 · Oscilaciones por viento: m x″ + c x′ + k x = F₀ sen(ωt). */
import { relSensitivity, observedOrder, nfmt, normInf, sub } from '../core/errors.js';
import { trapezoidData, simpsonData, trapezoid, simpson, romberg, referenceIntegral } from '../core/integrate.js';
import { integrate } from '../core/ode.js';
import { p, makeRun, thin, series, safeLog, tbl, sec, errorRow } from './common.js';
import { linearSuite } from './linear_suite.js';

export const meta = {
  id: 3, name: 'Oscilaciones por viento', short: 'Oscilaciones', icon: 'wind', unit: 'm',
  description: 'Respuesta lateral idealizada de una cabina (masa–resorte–amortiguador) ante una fuerza externa sintética.',
  methods: 'RK2 · RK4 · trapecio · Simpson · Romberg · sistemas lineales auxiliares',
  model: 'm x″ + c x′ + k x = F(t);  x′ = v;  v′ = [F(t) − c v − k x]/m',
};
export const params = [
  p('m', 'Masa equivalente m', 'kg', 1, 10000, 1), p('c', 'Amortiguamiento c', 'N·s/m', 0, 10000, 10), p('k', 'Rigidez k', 'N/m', 0.1, 100000, 10),
  p('F0', 'Amplitud de fuerza F₀', 'N', 0, 1000, 5), p('omega', 'Frecuencia de excitación ω', 'rad/s', 0.1, 20, 0.1),
  p('x0', 'Desplazamiento inicial x₀', 'm', -0.5, 0.5, 0.01), p('vInit', 'Velocidad inicial v₀', 'm/s', -2, 2, 0.01),
  p('h', 'Paso de integración h', 's', 0.005, 0.5, 0.005), p('T', 'Ventana de simulación T', 's', 2, 60, 1),
];
export const presets = {
  'NORMAL': { m: 500, c: 400, k: 2000, F0: 0, omega: 1.9, x0: 0.1, vInit: 0, h: 0.1, T: 10 },
  'ESTRÉS': { m: 500, c: 200, k: 2000, F0: 100, omega: 1.9, x0: 0, vInit: 0, h: 0.01, T: 10 },
  'MAL CONDICIONADO': { m: 500, c: 400, k: 2000, F0: 0, omega: 1.9, x0: 0.1, vInit: 0, h: 0.1, T: 10 },
};
export function validate(pr) {
  const w0 = Math.sqrt(pr.k / pr.m);
  if (pr.h > 0.5 / Math.max(1, w0 / 2)) throw Error('El paso es demasiado grande para la rigidez y la masa declaradas; reduce h.');
  const D = (pr.k - pr.m * pr.omega ** 2) ** 2 + (pr.c * pr.omega) ** 2;
  if (pr.F0 !== 0 && D < 1e-9) throw Error('Resonancia sin amortiguamiento: la amplitud estacionaria no está acotada.');
}

/** Solución analítica de x″ + 2γx′ + ω₀²x = (F₀/m) sen ωt con x(0), x′(0) dados (régimen sub, crítico y sobreamortiguado). */
export function exactOscillator(q) {
  const { m, c, k, F0, omega, x0, vInit } = q, g = c / (2 * m), w02 = k / m, disc = g * g - w02;
  let A = 0, B = 0;
  if (F0 !== 0) { const D = (k - m * omega ** 2) ** 2 + (c * omega) ** 2; A = (F0 * (k - m * omega ** 2)) / D; B = (-F0 * c * omega) / D; }
  const xp = (t) => A * Math.sin(omega * t) + B * Math.cos(omega * t), vp0 = omega * A, x0h = x0 - B, v0h = vInit - vp0;
  let hom;
  if (disc < -1e-12) { const wd = Math.sqrt(-disc), C1 = x0h, C2 = (v0h + g * C1) / wd; hom = (t) => Math.exp(-g * t) * (C1 * Math.cos(wd * t) + C2 * Math.sin(wd * t)); }
  else if (Math.abs(disc) <= 1e-12) { const C1 = x0h, C2 = v0h + g * C1; hom = (t) => Math.exp(-g * t) * (C1 + C2 * t); }
  else { const d = Math.sqrt(disc), r1 = -g + d, r2 = -g - d, C1 = (v0h - r2 * x0h) / (r1 - r2), C2 = x0h - C1; hom = (t) => C1 * Math.exp(r1 * t) + C2 * Math.exp(r2 * t); }
  return (t) => hom(t) + xp(t);
}
export const steadyAmplitude = (q, w) => q.F0 / Math.sqrt((q.k - q.m * w * w) ** 2 + (q.c * w) ** 2);

export function simulate(scenario, pr) {
  const { m, c, k, F0, omega, x0, vInit, h, T } = pr;
  const mal = scenario === 'MAL CONDICIONADO';
  const w0 = Math.sqrt(k / m), zeta = c / (2 * Math.sqrt(m * k)), wd = zeta < 1 ? w0 * Math.sqrt(1 - zeta * zeta) : 0;
  const xe = exactOscillator(pr), f = (t, y) => [y[1], (F0 * Math.sin(omega * t) - c * y[1] - k * y[0]) / m];
  const rk2 = integrate(2, f, [x0, vInit], T, h), rk4 = integrate(4, f, [x0, vInit], T, h);
  const e2 = rk2.rows.map((r) => Math.abs(r[1] - xe(r[0]))), e4 = rk4.rows.map((r) => Math.abs(r[1] - xe(r[0])));
  const max2 = Math.max(...e2), max4 = Math.max(...e4);
  let idx = 0; rk4.rows.forEach((r, i) => { if (Math.abs(r[1]) > Math.abs(rk4.rows[idx][1])) idx = i; });
  const maxAbs = Math.abs(rk4.rows[idx][1]), tPeak = rk4.rows[idx][0];
  const runs = [], sections = [];
  const rkRun = (name, res, errs, ord) => makeRun({ family: 'EDO', method: name, step: res.h, maxIter: res.steps, converged: true, iterations: thin(res.rows.map((r, i) => ({ k: i, approx: [r[1], r[2]], residual: null, error_abs: errs[i], error_rel: Math.abs(xe(r[0])) > 1e-12 ? errs[i] / Math.abs(xe(r[0])) : null })), 200), reference: 'Solución analítica x(t)', value: [res.rows.at(-1)[1], res.rows.at(-1)[2]], unit: 'm', metrics: { error_max: Math.max(...errs), orden_teorico: ord }, interpretation: 'Integración en el tiempo del sistema (x, v).' });
  runs.push(rkRun('RK2 (punto medio)', rk2, e2, 2), rkRun('RK4', rk4, e4, 4));

  /* ---------- EDO ---------- */
  const pick = [0, 1, 2, 4, 6, 8, 10].filter((tt) => tt <= T);
  const nearest = (res, tt) => res.rows.reduce((b, r) => (Math.abs(r[0] - tt) < Math.abs(b[0] - tt) ? r : b));
  const traj = pick.map((tt) => { const a = nearest(rk2, tt), b = nearest(rk4, tt), ref = xe(b[0]); return [nfmt(b[0], 4), nfmt(ref, 7), nfmt(a[1], 7), nfmt(b[1], 7), nfmt(Math.abs(ref - a[1])), nfmt(Math.abs(ref - b[1]))]; });
  const hs = [0.4, 0.2, 0.1, 0.05, 0.025].filter((hh) => hh <= 0.5);
  const study = hs.map((hh) => { const a = integrate(2, f, [x0, vInit], T, hh), b = integrate(4, f, [x0, vInit], T, hh); return { h: a.h, e2: Math.max(...a.rows.map((r) => Math.abs(r[1] - xe(r[0])))), e4: Math.max(...b.rows.map((r) => Math.abs(r[1] - xe(r[0])))) }; });
  const studyRows = study.map((s, i) => [nfmt(s.h), nfmt(s.e2), i ? nfmt(observedOrder(study[i - 1].e2, s.e2)) : '—', nfmt(s.e4), i ? nfmt(observedOrder(study[i - 1].e4, s.e4)) : '—']);
  runs.push(makeRun({ family: 'EDO', method: 'Estudio de refinamiento RK2/RK4', converged: true, iterations: study.map((s, i) => ({ k: i, approx: s.h, error_abs: s.e4 })), reference: 'Solución analítica', value: study.at(-1).e4, metrics: { orden_rk2: observedOrder(study.at(-2).e2, study.at(-1).e2), orden_rk4: observedOrder(study.at(-2).e4, study.at(-1).e4) }, interpretation: 'Orden observado al reducir h a la mitad.' }));
  const pl = (res, col) => thin(res.rows.map((r) => [r[0], r[col]]), 300);
  sections.push(sec('edo', 'EDO · RK2 (punto medio) y RK4',
    `Sistema x′ = v, v′ = [F(t) − c v − k x]/m con ω₀ = ${nfmt(w0, 6)} rad/s, ζ = ${nfmt(zeta, 4)}${zeta < 1 ? `, ω_d = ${nfmt(wd, 6)} rad/s (subamortiguado)` : ''}; h = ${nfmt(rk4.h)} s en [0, ${T}] s. ${F0 === 0 ? 'Vibración libre: x(t) = e^{−ζω₀t}[C₁ cos ω_d t + C₂ sen ω_d t].' : 'Respuesta forzada con solución analítica (particular + homogénea).'}`,
    [tbl('Trayectoria: referencia analítica, RK2 y RK4', ['t (s)', 'Referencia', 'RK2', 'RK4', 'Error RK2', 'Error RK4'], traj, `Error máximo en todos los nodos: RK2 ${nfmt(max2)} m; RK4 ${nfmt(max4)} m.`),
     tbl('Refinamiento: error máximo vs paso y orden observado', ['h (s)', 'Error RK2', 'Orden RK2', 'Error RK4', 'Orden RK4'], studyRows, 'Orden observado = log₂(e_h / e_{h/2}); se espera ≈ 2 (RK2) y ≈ 4 (RK4).')],
    [{ title: 'Desplazamiento lateral simulado', xLabel: 'Tiempo (s)', yLabel: 'Desplazamiento (m)', series: [series('Referencia analítica', thin(rk4.rows.map((r) => [r[0], xe(r[0])]), 300)), series('RK2', pl(rk2, 1), { dashed: true }), series('RK4', pl(rk4, 1))] },
     { title: 'Error absoluto frente a la referencia', xLabel: 'Tiempo (s)', yLabel: 'Error absoluto (m)', logY: true, series: [series('RK2', thin(rk2.rows.map((r, i) => [r[0], safeLog(e2[i])]), 300)), series('RK4', thin(rk4.rows.map((r, i) => [r[0], safeLog(e4[i])]), 300))] },
     { title: 'Error máximo vs paso (log-log)', xLabel: 'Paso h (s)', yLabel: 'Error máximo (m)', logX: true, logY: true, series: [series('RK2', study.map((s) => [s.h, safeLog(s.e2)]), { markers: true }), series('RK4', study.map((s) => [s.h, safeLog(s.e4)]), { markers: true })] }]));

  /* ---------- Integración de x(t)² ---------- */
  const x2 = (t) => xe(t) ** 2, refI = referenceIntegral(x2, 0, T);
  const N = rk4.steps, hh = rk4.h;
  const yR4 = rk4.rows.map((r) => r[1] ** 2), yEx = rk4.rows.map((r) => x2(r[0]));
  const trR4 = trapezoidData(yR4, hh), spR4 = simpsonData(yR4, hh), rb = romberg(x2, 0, T, 9);
  const ns = [20, 40, 80, 160, 320];
  const refine = ns.map((n) => ({ n, tr: trapezoid(x2, 0, T, n), sp: simpson(x2, 0, T, n) }));
  const refineRows = refine.map((s, i) => [s.n, nfmt(s.tr, 10), nfmt(Math.abs(s.tr - refI.value)), i ? nfmt(observedOrder(Math.abs(refine[i - 1].tr - refI.value), Math.abs(s.tr - refI.value))) : '—', nfmt(s.sp, 10), nfmt(Math.abs(s.sp - refI.value)), i ? nfmt(observedOrder(Math.abs(refine[i - 1].sp - refI.value), Math.abs(s.sp - refI.value))) : '—']);
  const intRows = [['Referencia (Gauss-Legendre 10 pts × 400 paneles)', nfmt(refI.value, 10), '—'], [`Trapecio sobre x_RK4², h = ${nfmt(hh)}`, nfmt(trR4, 10), nfmt(Math.abs(trR4 - refI.value))], [`Simpson 1/3 sobre x_RK4², h = ${nfmt(hh)}`, Number.isNaN(spR4) ? 'N impar' : nfmt(spR4, 10), Number.isNaN(spR4) ? '—' : nfmt(Math.abs(spR4 - refI.value))], ['Romberg sobre x_exacta² (9 niveles)', nfmt(rb.value, 10), nfmt(Math.abs(rb.value - refI.value))]];
  runs.push(makeRun({ family: 'Integración', method: 'Trapecio compuesto (x_RK4²)', step: hh, maxIter: N, iterations: refine.map((s) => ({ k: s.n, approx: s.tr, error_abs: Math.abs(s.tr - refI.value), error_rel: Math.abs(s.tr - refI.value) / refI.value })), reference: `Gauss-Legendre: ${nfmt(refI.value, 10)} m²·s`, value: trR4, unit: 'm²·s', metrics: { error_abs: Math.abs(trR4 - refI.value) }, interpretation: 'Magnitud acumulada ∫x²dt (no es energía mecánica).' }));
  runs.push(makeRun({ family: 'Integración', method: 'Simpson 1/3 compuesto (x_RK4²)', step: hh, maxIter: N, iterations: refine.map((s) => ({ k: s.n, approx: s.sp, error_abs: Math.abs(s.sp - refI.value), error_rel: Math.abs(s.sp - refI.value) / refI.value })), reference: `Gauss-Legendre: ${nfmt(refI.value, 10)} m²·s`, value: spR4, unit: 'm²·s', metrics: { error_abs: Math.abs(spR4 - refI.value) }, interpretation: 'Error combinado de EDO y cuadratura.' }));
  runs.push(makeRun({ family: 'Integración', method: 'Romberg (x_exacta²)', maxIter: 9, iterations: rb.table.map((r, i) => ({ k: i, approx: r.at(-1), error_abs: Math.abs(r.at(-1) - refI.value), error_rel: Math.abs(r.at(-1) - refI.value) / refI.value })), reference: `Gauss-Legendre: ${nfmt(refI.value, 10)} m²·s`, value: rb.value, unit: 'm²·s', metrics: { error_abs: Math.abs(rb.value - refI.value) }, interpretation: 'Separa el error de cuadratura del error de la EDO.' }));
  sections.push(sec('integracion', 'Integración · magnitud acumulada I = ∫ x(t)² dt',
    `I = ∫₀^${T} x² dt tiene unidad m²·s y mide el desplazamiento cuadrático acumulado (no la energía mecánica). La referencia independiente usa Gauss-Legendre de 10 puntos con 400 paneles (diferencia con 200 paneles: ${nfmt(refI.check)}).`,
    [tbl('Cálculos de I y errores', ['Cálculo', 'Valor (m²·s)', 'Error absoluto'], intRows, 'El error de Simpson sobre la trayectoria numérica combina error de RK4 y de cuadratura; Romberg se aplica sobre la función analítica para separar ambas fuentes.'),
     tbl('Refinamiento sobre x_exacta²: trapecio y Simpson', ['n', 'Trapecio', 'Error', 'Orden', 'Simpson', 'Error', 'Orden'], refineRows),
     tbl('Tabla de Romberg (últimas filas)', ['Nivel', 'R(i,0)', 'R(i,1)', 'R(i,2)', 'R(i,3)'], rb.table.slice(-4).map((r, i) => [rb.table.length - 4 + i, ...r.slice(0, 4).map((v) => nfmt(v, 12)), ...Array(Math.max(0, 4 - r.length)).fill('')]))],
    [{ title: 'Error de integración vs n (log-log)', xLabel: 'Subintervalos n', yLabel: 'Error absoluto (m²·s)', logX: true, logY: true, series: [series('Trapecio', refine.map((s) => [s.n, safeLog(Math.abs(s.tr - refI.value))]), { markers: true }), series('Simpson 1/3', refine.map((s) => [s.n, safeLog(Math.abs(s.sp - refI.value))]), { markers: true })] }]));

  /* ---------- Sistemas lineales auxiliares (MAL CONDICIONADO) ---------- */
  let lin = null;
  if (mal) {
    lin = linearSuite('MAL CONDICIONADO'); runs.push(...lin.dbRuns);
    sections.push(sec('sistemas', 'Sistema lineal auxiliar SPD · calibración mal condicionada',
      'Subexperimento numérico (no es una condición operativa): calibrar cuatro rigideces equivalentes con sensibilidades escaladas 1, 10⁻², 10⁻⁴, 10⁻⁶. La intensidad del viento no se relaciona con este mal condicionamiento.',
      [lin.summaryTable, lin.conv, tbl('Perturbación de datos', ['Magnitud', 'Valor'], [['‖δb‖∞/‖b‖∞', nfmt(lin.perturbation.relB)], ['‖δx‖∞/‖x*‖∞', nfmt(lin.perturbation.relX)], ['Amplificación', nfmt(lin.perturbation.relX / lin.perturbation.relB)], ['κ₂(A)', nfmt(lin.info.cond2)]])], [lin.plot]));
  }

  /* ---------- Resonancia, sensibilidad y errores ---------- */
  const wr = Math.sqrt(Math.max(0, w0 * w0 - 2 * (c / (2 * m)) ** 2));
  const sweep = Array.from({ length: 121 }, (_, i) => 0.1 + (3 * w0 - 0.1) * i / 120).map((w) => [w, F0 > 0 ? steadyAmplitude({ m, c, k, F0 }, w) : steadyAmplitude({ m, c, k, F0: 100 }, w)]);
  const ampOf = (q) => { const r = integrate(4, (t, y) => [y[1], (q.F0 * Math.sin(q.omega * t) - q.c * y[1] - q.k * y[0]) / q.m], [q.x0, q.vInit], T, h); return Math.max(...r.rows.map((z) => Math.abs(z[1]))); };
  const sens = ['m', 'c', 'k'].map((key) => { const s = relSensitivity(ampOf, pr, key, 0.01); return [key === 'm' ? 'm' : key, nfmt(s.base, 7), nfmt(s.pert, 7), nfmt(100 * s.relChange, 4) + ' %', nfmt(s.amplification, 4)]; });
  const errTbl = tbl('Errores por método frente a la referencia analítica', ['Método / magnitud', 'Aproximación', 'Referencia', 'Eₐ', 'Eᵣ', 'Eₚ'], [
    errorRow('RK2 · x(T) (m)', rk2.rows.at(-1)[1], xe(T)), errorRow('RK4 · x(T) (m)', rk4.rows.at(-1)[1], xe(T)),
    errorRow('Trapecio · I (m²·s)', trR4, refI.value), errorRow('Simpson · I (m²·s)', spR4, refI.value), errorRow('Romberg · I (m²·s)', rb.value, refI.value)]);
  const errTables = [errTbl, tbl('Sensibilidad de la amplitud máxima ante +1 % en un parámetro', ['Parámetro', 'max|x| base (m)', 'max|x| perturbado', 'Cambio relativo', 'Amplificación'], sens, 'Sensibilidad del modelo físico, no error del algoritmo.')];
  if (F0 > 0) errTables.push(tbl('Respuesta estacionaria teórica', ['Magnitud', 'Valor'], [['Amplitud estacionaria en ω', nfmt(steadyAmplitude(pr, omega)) + ' m'], ['Frecuencia de resonancia ω_r', nfmt(wr, 5) + ' rad/s'], ['Amplitud máx. teórica (ω_r)', nfmt(steadyAmplitude(pr, wr || omega)) + ' m'], ['Máx. |x| calculado en la malla', `${nfmt(maxAbs, 7)} m en t ≈ ${nfmt(tPeak, 4)} s`]], 'El máximo depende de la ventana de simulación y no es una respuesta máxima universal ni un umbral operativo.'));
  sections.push(sec('errores', 'Errores, sensibilidad y respuesta en frecuencia', 'La curva de amplitud estacionaria F₀/√((k−mω²)²+(cω)²) muestra qué frecuencias excitan más al sistema lineal.', errTables,
    [{ title: 'Amplitud estacionaria vs frecuencia de excitación', xLabel: 'ω (rad/s)', yLabel: 'Amplitud (m)', series: [series(F0 > 0 ? `F₀ = ${F0} N` : 'Referencia con F₀ = 100 N (esta ejecución no tiene fuerza)', sweep)], vlines: [{ x: w0, label: 'ω₀' }, ...(F0 > 0 ? [{ x: omega, label: 'ω excitación' }] : [])] }]));

  const ratio = max2 / Math.max(max4, 1e-300);
  const numeric = `RK4 tiene error máximo ${nfmt(max4)} m frente a ${nfmt(max2)} m de RK2 (RK4 es ≈ ${nfmt(ratio, 3)} veces más preciso con el mismo h = ${nfmt(rk4.h)} s). El estudio de refinamiento da órdenes observados ≈ ${nfmt(observedOrder(study.at(-2).e2, study.at(-1).e2), 3)} (RK2) y ≈ ${nfmt(observedOrder(study.at(-2).e4, study.at(-1).e4), 3)} (RK4). Para I = ∫x²dt el trapecio y Simpson sobre la trayectoria RK4 tienen errores ${nfmt(Math.abs(trR4 - refI.value))} y ${nfmt(Math.abs(spR4 - refI.value))}, mientras que Romberg sobre la función analítica alcanza ${nfmt(Math.abs(rb.value - refI.value))}.${mal ? ` En la calibración auxiliar la amplificación ${nfmt(lin.perturbation.relX / lin.perturbation.relB)} ≈ κ₂ = ${nfmt(lin.info.cond2)} no depende del método.` : ''}`;
  const physical = F0 === 0
    ? `En vibración libre (ζ = ${nfmt(zeta, 3)}) la amplitud decae de ${nfmt(Math.abs(x0))} m con ω_d = ${nfmt(wd, 5)} rad/s; la magnitud acumulada es I = ${nfmt(refI.value, 6)} m²·s. Más amortiguamiento reduce I; más rigidez aumenta la frecuencia. El modelo no incluye interacción real cabina–cable–torre ni turbulencia.`
    : `Con fuerza periódica F₀ = ${F0} N y ω = ${omega} rad/s (cerca de ω₀ = ${nfmt(w0, 3)}), el máximo calculado en la ventana es |x| = ${nfmt(maxAbs, 5)} m (t ≈ ${nfmt(tPeak, 3)} s) y I = ${nfmt(refI.value, 6)} m²·s. Menor amortiguamiento y excitación cercana a la resonancia aumentan la amplitud; este valor depende de la ventana [0, ${T}] s y no es un umbral operativo.`;
  const summary = [
    { label: 'Amplitud máx. |x|', value: nfmt(maxAbs, 6), unit: 'm' }, { label: 'Instante del pico', value: nfmt(tPeak, 4), unit: 's' },
    { label: 'Error máx. RK2', value: nfmt(max2), unit: 'm' }, { label: 'Error máx. RK4', value: nfmt(max4), unit: 'm' },
    { label: 'Integral I = ∫x²dt', value: nfmt(refI.value, 8), unit: 'm²·s' }, { label: 'ζ (razón de amortiguamiento)', value: nfmt(zeta, 4), unit: '' },
  ];
  return { summary, sections, runs, metric: { label: 'Amplitud máxima', value: maxAbs, unit: 'm' }, numeric, physical,
    note: mal ? 'MAL CONDICIONADO: sistema SPD auxiliar de calibración (κ₂ = 10⁶); para la trayectoria se usan los parámetros de NORMAL. No implica mayor peligro físico.' : F0 === 0 ? 'Referencia exacta para vibración libre; sin conexión con sensores reales.' : 'Referencia analítica de la respuesta forzada lineal; datos sintéticos.',
    plots: sections.flatMap((s) => s.plots), tables: sections.flatMap((s) => s.tables), extra: { zeta, w0, wd, maxAbs, tPeak } };
}
