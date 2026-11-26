/** Caso 4 · Reconstrucción de señales de sensores: s(t) = A·sen(t), yᵢ = s(tᵢ) + εᵢ. */
import { rng, gauss, stats, histogram, nfmt, normInf, sub, errorSet } from '../core/errors.js';
import { lagrange, lagrangeBasis, dividedDifferences, newtonEval, naturalSpline, chebyshevNodes, uniformNodes, vandermonde, vandermondeCond, monomialCoeffs, polyEval } from '../core/interp.js';
import { bisection, newton, secant, estimateOrder } from '../core/roots.js';
import { luFactor, luSolve } from '../core/linear.js';
import { p, makeRun, traceIterations, thin, samples, series, safeLog, tbl, sec, errorRow } from './common.js';

export const meta = {
  id: 4, name: 'Reconstrucción de sensores', short: 'Sensores', icon: 'activity', unit: 'u.',
  description: 'Recuperación de lecturas perdidas y efecto del ruido sobre la reconstrucción.',
  methods: 'Lagrange · Newton (diferencias divididas) · spline cúbico natural · raíces · sistemas lineales',
  model: 's(t) = A·sen(t);  yᵢ = s(tᵢ) + εᵢ;  P₃(t) = Σ yᵢ Lᵢ(t)',
};
export const params = [
  p('amp', 'Amplitud de la señal A', 'u.', 0.01, 10, 0.1), p('noiseScale', 'Factor de ruido determinista ε', '×', 0, 10, 0.1),
  p('test1', 'Muestra oculta 1', 's', 0, 2, 0.001), p('test2', 'Muestra oculta 2', 's', 0, 2, 0.001),
  p('theta', 'Umbral θ de cruce', 'u.', -10, 10, 0.01), p('sigma', 'Ruido aleatorio σ (Monte Carlo)', 'u.', 0, 0.5, 0.005),
  { key: 'nodeMode', label: 'Distribución de nodos', unit: '', type: 'select', options: [[0, 'Dada: 0; 0.5; 1.5; 2'], [1, 'Uniforme (4 nodos)'], [2, 'Chebyshev (4 nodos)']] },
];
export const presets = {
  'NORMAL': { amp: 1, noiseScale: 0, test1: 0.75, test2: 1.25, theta: 0.9, sigma: 0.02, nodeMode: 0 },
  'ESTRÉS': { amp: 1, noiseScale: 1, test1: 0.75, test2: 1.25, theta: 0.9, sigma: 0.02, nodeMode: 0 },
  'MAL CONDICIONADO': { amp: 1, noiseScale: 0, test1: 0.0015, test2: 0.0025, theta: 0.002, sigma: 0.000001, nodeMode: 0 },
};
const EPS = [0.015, -0.02, 0.025, -0.015];
export const nodesFor = (scenario, mode) => {
  if (scenario === 'MAL CONDICIONADO') return [0, 0.001, 0.002, 0.003];
  return mode === 1 ? uniformNodes(0, 2, 4) : mode === 2 ? chebyshevNodes(0, 2, 4) : [0, 0.5, 1.5, 2];
};
export function validate(pr, scenario = 'NORMAL') {
  const xs = nodesFor(scenario, pr.nodeMode), lo = xs[0], hi = xs.at(-1);
  for (const t of [pr.test1, pr.test2]) if (!(t > lo && t < hi) || xs.some((x) => Math.abs(x - t) < 1e-10)) throw Error(`Los puntos ocultos deben estar en (${lo}, ${hi}) y ser distintos de los nodos conocidos.`);
  if (Math.abs(pr.test1 - pr.test2) < 1e-9) throw Error('Elige dos puntos ocultos distintos.');
}
const dNewtonEval = (xs, coef, t) => { // derivada del polinomio en forma de Newton (Horner derivado)
  let v = coef.at(-1), d = 0;
  for (let j = coef.length - 2; j >= 0; j--) { d = d * (t - xs[j]) + v; v = v * (t - xs[j]) + coef[j]; }
  return d;
};

export function simulate(scenario, pr) {
  const { amp, noiseScale, test1, test2, theta, sigma } = pr, mal = scenario === 'MAL CONDICIONADO';
  const xs = nodesFor(scenario, pr.nodeMode), a = xs[0], b = xs.at(-1), sig = (t) => amp * Math.sin(t);
  const ys = xs.map((t, i) => sig(t) + noiseScale * EPS[i]), hidden = [test1, test2];
  const dd = dividedDifferences(xs, ys), sp = naturalSpline(xs, ys);
  const P = (t) => lagrange(xs, ys, t), N = (t) => newtonEval(xs, dd.coef, t), S = (t) => sp.evalAt(t);
  const methods = [['Lagrange', P], ['Newton (dif. divididas)', N], ['Spline cúbico natural', S]];
  const runs = [], sections = [];

  /* ---------- Interpolación en puntos ocultos ---------- */
  const hid = [];
  for (const t of hidden) for (const [name, fn] of methods) { const v = fn(t), ref = sig(t); hid.push({ t, name, v, ref, ...errorSet(v, ref) }); }
  for (const [name, fn] of methods) {
    const rows = hid.filter((h) => h.name === name);
    runs.push(makeRun({ family: 'Interpolación', method: name, converged: true, iterations: rows.map((r, i) => ({ k: i, approx: [r.t, r.v], residual: null, error_abs: r.abs, error_rel: r.rel })), reference: `s(t) = ${amp}·sen(t)`, value: rows.map((r) => r.v), unit: 'u.', metrics: { error_max: Math.max(...rows.map((r) => r.abs)), error_pct_max: Math.max(...rows.map((r) => r.pct ?? 0)) }, interpretation: 'Predicción en puntos ocultados independientes de los nodos.' }));
  }
  const lag0 = lagrangeBasis(xs, test1);
  const hidRows = hid.map((h) => [nfmt(h.t, 5), h.name, nfmt(h.v, 8), nfmt(h.ref, 8), nfmt(h.abs), h.pct === null ? '—' : nfmt(h.pct, 4) + ' %']);
  const cont = samples(a, b, 200, (t) => t);
  const errCurve = (fn) => cont.map(([t]) => [t, safeLog(Math.abs(fn(t) - sig(t)), 1e-18)]);
  const diffLN = Math.max(...cont.map(([t]) => Math.abs(P(t) - N(t))));
  const intPlot = { title: 'Reconstrucción: señal, interpolantes y datos', xLabel: 'Tiempo (s)', yLabel: 'Lectura (u.)', series: [series('Señal exacta', samples(a, b, 160, sig)), series('Polinomio (Lagrange = Newton)', samples(a, b, 160, P), { dashed: true }), series('Spline natural', samples(a, b, 160, S), { dotted: true }), series('Nodos conocidos', xs.map((t, i) => [t, ys[i]]), { scatter: true }), series('Datos ocultados', hidden.map((t) => [t, sig(t)]), { scatter: true, cross: true })] };
  const errPlot = { title: 'Error absoluto continuo |interpolante − señal|', xLabel: 'Tiempo (s)', yLabel: 'Error absoluto (u.)', logY: true, series: [series('Polinomio', errCurve(P)), series('Spline natural', errCurve(S))] };
  sections.push(sec('interpolacion', 'Interpolación · Lagrange, Newton y spline cúbico natural',
    `Nodos t = (${xs.map((x) => nfmt(Number(x.toPrecision(6)))).join('; ')}) s; datos ocultados t = (${hidden.join('; ')}) s. Lagrange y Newton representan el MISMO polinomio de grado ≤ 3 (máx. |P_L − P_N| = ${nfmt(diffLN)}).`,
    [tbl('Pruebas con datos ocultados', ['t (s)', 'Método', 'Predicción', 'Referencia', 'Eₐ', 'Eₚ'], hidRows),
     tbl(`Bases de Lagrange Lᵢ(${test1})`, ['i', 'tᵢ (s)', 'yᵢ observado', 'Lᵢ(t)', 'yᵢ·Lᵢ'], xs.map((x, i) => [i, nfmt(x, 6), nfmt(ys[i], 8), nfmt(lag0[i], 8), nfmt(ys[i] * lag0[i], 8)]), `Σ Lᵢ = ${nfmt(lag0.reduce((s, v) => s + v, 0), 12)} (partición de la unidad); P(${test1}) = ${nfmt(P(test1), 9)}.`),
     tbl('Tabla de diferencias divididas (Newton)', ['Orden', ...xs.map((_, i) => `f[·] ${i}`)], dd.table.map((col, j) => [j, ...col.map((v) => nfmt(v, 8)), ...Array(xs.length - col.length).fill('')]), `Coeficientes del polinomio de Newton: ${dd.coef.map((v) => nfmt(v, 8)).join('; ')}.`),
     tbl('Spline natural: sistema reducido de segundas derivadas M₁…M_{n−2}', ['Magnitud', 'Valor'], [['h', sp.h.map((v) => nfmt(Number(v.toPrecision(6)))).join('; ')], ['Matriz reducida', sp.reduced.A.map((r) => '[' + r.map((v) => nfmt(Number(v.toPrecision(6)))).join(' ') + ']').join(' ')], ['Lado derecho', sp.reduced.b.map((v) => nfmt(v, 8)).join('; ')], ['M (con M₀ = M₃ = 0)', sp.M.map((v) => nfmt(v, 8)).join('; ')]], 'Condición natural S″(t₀) = S″(t_n) = 0; el sistema es tridiagonal, simétrico y estrictamente dominante.')],
    [intPlot, errPlot]));

  /* ---------- Espaciamiento de nodos ---------- */
  const err_max = (fn, f, lo, hi) => Math.max(...samples(lo, hi, 400, (t) => t).map(([t]) => Math.abs(fn(t) - f(t))));
  const spacing = [5, 9, 13, 17, 21].map((n) => {
    const u = uniformNodes(0, 2, n), c = chebyshevNodes(0, 2, n);
    const pu = (t) => lagrange(u, u.map(sig), t), pc = (t) => lagrange(c, c.map(sig), t);
    const ru = uniformNodes(-1, 1, n), rc = chebyshevNodes(-1, 1, n), rf = (t) => 1 / (1 + 25 * t * t);
    return { n, su: err_max(pu, sig, 0, 2), sc: err_max(pc, sig, 0, 2), ru: err_max((t) => lagrange(ru, ru.map(rf), t), rf, -1, 1), rc: err_max((t) => lagrange(rc, rc.map(rf), t), rf, -1, 1) };
  });
  const spRows = spacing.map((s) => [s.n, nfmt(s.su), nfmt(s.sc), nfmt(s.ru), nfmt(s.rc)]);
  const spaceRun = makeRun({ family: 'Interpolación', method: 'Efecto del espaciamiento de nodos', converged: true, iterations: spacing.map((s) => ({ k: s.n, approx: [s.su, s.sc], error_abs: s.sc })), reference: 'sen(t) y Runge 1/(1+25t²)', value: spacing.at(-1).rc, metrics: { runge_uniforme_nmax: spacing.at(-1).ru, runge_chebyshev_nmax: spacing.at(-1).rc }, interpretation: 'Nodos uniformes con Runge divergen; Chebyshev converge.' });
  runs.push(spaceRun);
  sections.push(sec('nodos', 'Efecto del espaciamiento de nodos',
    'Máximo error de interpolación polinómica con n nodos uniformes frente a nodos de Chebyshev. La señal senoidal es muy suave; la función auxiliar de Runge 1/(1+25t²) en [−1, 1] muestra el fenómeno de Runge.',
    [tbl('Error máximo vs número de nodos', ['n', 'sen(t) uniforme', 'sen(t) Chebyshev', 'Runge uniforme', 'Runge Chebyshev'], spRows, 'Con nodos uniformes el error de Runge crece con n; con Chebyshev decrece.')],
    [{ title: 'Función de Runge: error máximo vs n', xLabel: 'Número de nodos n', yLabel: 'Error máximo', logY: true, series: [series('Uniformes', spacing.map((s) => [s.n, safeLog(s.ru)]), { markers: true }), series('Chebyshev', spacing.map((s) => [s.n, safeLog(s.rc)]), { markers: true })] }]));

  /* ---------- Ruido: determinista y Monte Carlo ---------- */
  const rand = rng(20261112), M = 1000, eP = [[], []], eS = [[], []], base = xs.map(sig);
  for (let i = 0; i < M; i++) {
    const yn = base.map((v) => v + sigma * gauss(rand)), d2 = dividedDifferences(xs, yn), s2 = naturalSpline(xs, yn);
    hidden.forEach((t, j) => { eP[j].push(newtonEval(xs, d2.coef, t) - sig(t)); eS[j].push(s2.evalAt(t) - sig(t)); });
  }
  const rms = (v) => Math.sqrt(v.reduce((s, x) => s + x * x, 0) / v.length);
  const theory = hidden.map((t) => sigma * Math.sqrt(lagrangeBasis(xs, t).reduce((s, v) => s + v * v, 0)));
  const mcRows = hidden.flatMap((t, j) => [[nfmt(t, 5), 'Polinomio', nfmt(rms(eP[j])), nfmt(theory[j]), sigma > 0 ? nfmt(rms(eP[j]) / sigma, 4) : '—', nfmt(stats(eP[j].map(Math.abs)).p95)], [nfmt(t, 5), 'Spline natural', nfmt(rms(eS[j])), '—', sigma > 0 ? nfmt(rms(eS[j]) / sigma, 4) : '—', nfmt(stats(eS[j].map(Math.abs)).p95)]]);
  runs.push(makeRun({ family: 'Interpolación', method: 'Monte Carlo de ruido (σ)', maxIter: M, converged: true, iterations: hidden.map((t, j) => ({ k: j, approx: [t, rms(eP[j]), rms(eS[j])], error_abs: rms(eP[j]) })), reference: `RMS teórico del polinomio = ${theory.map((v) => nfmt(v)).join('; ')}`, value: [rms(eP[0]), rms(eP[1])], metrics: { sigma, N: M }, interpretation: 'RMS del error con ruido gaussiano independiente en los nodos.' }));
  const detRows = hid.filter((h) => h.name !== 'Newton (dif. divididas)').map((h) => [nfmt(h.t, 5), h.name, nfmt(h.abs), h.pct === null ? '—' : nfmt(h.pct, 4) + ' %']);
  const histo = histogram(eP[0], 24);
  sections.push(sec('ruido', 'Estabilidad frente al ruido',
    `Ruido determinista del informe ε = (0.015, −0.020, 0.025, −0.015) × ${noiseScale} y ruido aleatorio gaussiano σ = ${sigma} en los nodos (Monte Carlo N = ${M}, semilla fija). Una interpolación exacta atraviesa los nodos ruidosos: el ruido se amplifica por el factor √Σ Lᵢ(t)² (polinomio).`,
    [tbl('Error en los puntos ocultos con el ruido seleccionado', ['t (s)', 'Método', 'Eₐ', 'Eₚ'], detRows),
     tbl('Monte Carlo: error RMS con ruido aleatorio σ', ['t (s)', 'Método', 'RMS error', 'RMS teórico (polinomio)', 'Amplificación RMS/σ', 'Percentil 95 |error|'], mcRows, 'El RMS teórico σ·√ΣLᵢ² verifica la simulación para el polinomio; el spline natural amplifica de forma distinta.')],
    [{ title: 'Distribución del error del polinomio en el primer punto oculto', xLabel: 'Error de reconstrucción (u.)', yLabel: 'Frecuencia relativa', kind: 'bars', series: [series('Frecuencia', histo.map((q) => [q.x, q.share]))] }]));

  /* ---------- Raíces: cruce de umbral ---------- */
  let rootSection = null, rootOk = false;
  const g = (t) => P(t) - theta, gp = (t) => dNewtonEval(xs, dd.coef, t);
  let bracket = null;
  const grid = samples(a, b, 400, (t) => g(t));
  for (let i = 0; i < grid.length - 1; i++) if (grid[i][1] * grid[i + 1][1] < 0) { bracket = [grid[i][0], grid[i + 1][0]]; break; }
  if (bracket) {
    const ref = Math.asin(theta / amp), bis = bisection(g, bracket[0], bracket[1], { tol: 1e-12, ref }), x0 = (bracket[0] + bracket[1]) / 2;
    const nw = newton(g, gp, x0, { tol: 1e-13, ref }), sc = secant(g, bracket[0], bracket[1], { tol: 1e-13, ref }), rr = [bis, nw, sc];
    for (const r of rr) runs.push(makeRun({ family: 'Raíces', method: `${r.method} · cruce P(t)=θ`, tolerance: r.tol, maxIter: r.maxIter, converged: r.converged, timeMs: r.timeMs, iterations: traceIterations(r.trace, ref), reference: `asen(θ/A) = ${nfmt(ref, 10)} s`, value: r.root, unit: 's', metrics: { error_abs: Math.abs(r.root - ref), residual: Math.abs(g(r.root)) }, interpretation: 'Instante en que la curva reconstruida cruza el umbral.' }));
    rootSection = sec('raices', 'Raíces · cruce de umbral de la curva interpolada', `Se resuelve P(t) − θ = 0 con θ = ${theta} u. en [${nfmt(bracket[0], 5)}, ${nfmt(bracket[1], 5)}]. Referencia exacta (señal sin ruido): t = arcsen(θ/A) = ${nfmt(ref, 10)} s.`,
      [tbl('Métodos de raíces sobre el polinomio interpolante', ['Método', 'Semillas', 'Iteraciones', 'Raíz (s)', 'Residual', 'Error vs arcsen', 'Convergió'], rr.map((r) => [r.method, r.seed, r.iterations, nfmt(r.root, 10), nfmt(Math.abs(g(r.root))), nfmt(Math.abs(r.root - ref)), r.converged ? 'Sí' : 'No']), 'El error respecto de arcsen(θ/A) incluye el error de interpolación, no solo el del método de raíces.')],
      [{ title: 'Convergencia del residual', xLabel: 'Iteración', yLabel: '|P(t) − θ|', logY: true, series: rr.map((r) => series(r.method, thin(r.trace.map((t) => [t.k, safeLog(t.residual)]), 100), r.trace.length < 10 ? { markers: true } : {})) }]);
    rootOk = true; sections.push(rootSection);
  }

  /* ---------- Sistema lineal de Vandermonde y condicionamiento ---------- */
  const V = vandermonde(xs), kV = vandermondeCond(xs);
  const scale = b - a, tau = xs.map((t) => (t - a) / scale), kS = vandermondeCond(tau);
  const cRaw = luSolve(luFactor(V), ys).x;
  const cScaled = luSolve(luFactor(vandermonde(tau)), ys).x;
  const cBack = cScaled.map((v, j) => v / scale ** j); // coeficientes en potencias de (t−a)
  const cRawShift = (() => { // convertir cRaw (potencias de t) a potencias de (t−a) por desarrollo binomial
    const out = Array(cRaw.length).fill(0);
    cRaw.forEach((cj, j) => { for (let i = 0; i <= j; i++) out[i] += cj * binom(j, i) * a ** (j - i); });
    return out;
  })();
  function binom(n, k) { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; }
  const coefErr = normInf(sub(cRawShift, cBack)) / Math.max(normInf(cBack), 1e-300);
  const predDiff = Math.max(...samples(a, b, 100, (t) => t).map(([t]) => Math.abs(polyEval(cRaw, t) - polyEval(cBack.map((v, j) => v * scale ** j), (t - a) / scale))));
  // Perturbación δy en el último dato: sensibilidad de coeficientes vs estabilidad de la predicción
  const dy = 1e-6 * amp, ysP = ys.map((v, i) => (i === ys.length - 1 ? v + dy : v));
  const cRawP = luSolve(luFactor(V), ysP).x, cScaledP = luSolve(luFactor(vandermonde(tau)), ysP).x;
  const relY = dy / Math.max(normInf(ys), 1e-300);
  const relCraw = normInf(sub(cRawP, cRaw)) / Math.max(normInf(cRaw), 1e-300), relCsc = normInf(sub(cScaledP, cScaled)) / Math.max(normInf(cScaled), 1e-300);
  const relPred = Math.max(...samples(a, b, 100, (t) => t).map(([t]) => Math.abs(polyEval(cRawP, t) - polyEval(cRaw, t)))) / Math.max(normInf(ys), 1e-300);
  runs.push(makeRun({ family: 'Sistemas lineales', method: 'LU · Vandermonde V c = y', converged: true, iterations: [{ k: 0, approx: cRaw, error_abs: coefErr }, { k: 1, approx: cScaled, error_abs: null }], reference: 'Vandermonde escalado τ = (t−t₀)/(t_n−t₀)', value: cRaw, metrics: { kappa2: kV, kappa2_escalado: kS, diferencia_coeficientes_rel: coefErr, diferencia_predicciones: predDiff, amplificacion_coeficientes: relCraw / relY, amplificacion_prediccion: relPred / relY }, interpretation: 'Mal condicionamiento de coeficientes en potencias no escaladas.' }));
  sections.push(sec('condicion', 'Sistema lineal de Vandermonde y escalamiento',
    'Los coeficientes del polinomio en potencias de t resuelven V c = y (matriz de Vandermonde, no SPD: solo LU/directo son aplicables; Jacobi, Gauss-Seidel y CG estándar no corresponden). El condicionamiento depende de la representación.',
    [tbl('Condicionamiento de la matriz de Vandermonde', ['Magnitud', 'Valor'], [['κ₂(V) con t sin escalar', nfmt(kV, 6)], ['κ₂(V) con τ = (t − t₀)/(t_n − t₀)', nfmt(kS, 6)], ['Diferencia relativa entre coeficientes (t vs τ)', nfmt(coefErr)], ['Máx. diferencia entre predicciones en [t₀, t_n]', nfmt(predDiff)], [`Perturbación δy = ${nfmt(dy)} en el último dato (relativa ${nfmt(relY)})`, ''], ['  cambio relativo de coeficientes (t sin escalar)', `${nfmt(relCraw)} → amplificación ${nfmt(relCraw / relY, 4)}`], ['  cambio relativo de coeficientes (τ escalado)', `${nfmt(relCsc)} → amplificación ${nfmt(relCsc / relY, 4)}`], ['  cambio relativo de la predicción en [t₀, t_n]', `${nfmt(relPred)} → amplificación ${nfmt(relPred / relY, 4)}`]], mal ? 'Nodos (0; 0.001; 0.002; 0.003): κ₂ ≈ 1.4907×10⁹ sin escalar y ≈ 98.868 con τ. La mala condición afecta a los coeficientes en potencias de t; la predicción dentro del intervalo sigue siendo estable. Centrar/escalar reduce la dificultad.' : 'Con nodos moderados el sistema está bien condicionado; el escalamiento mantiene la misma predicción.'),
     tbl('Coeficientes (potencias de t − t₀)', ['Grado', 'Sin escalar (LU)', 'Escalado (LU)'], cRawShift.map((v, j) => [j, nfmt(v, 12), nfmt(cBack[j], 12)]))], []));

  /* ---------- Resúmenes ---------- */
  const maxErr = Math.max(...hid.map((h) => h.abs));
  const errPoly = hid.filter((h) => h.name === 'Lagrange').map((h) => h.abs), errSpl = hid.filter((h) => h.name.startsWith('Spline')).map((h) => h.abs);
  const numeric = `Lagrange y Newton producen el mismo polinomio (diferencia máx. ${nfmt(diffLN)}); el spline natural da errores ${nfmt(Math.max(...errSpl))} frente a ${nfmt(Math.max(...errPoly))} del polinomio en los puntos ocultados. ${noiseScale > 0 ? 'Con ruido el error en los nodos se transmite a la reconstrucción y se amplifica en los puntos intermedios (Monte Carlo y factor √ΣLᵢ²).' : ''} ${mal ? `κ₂(V) = ${nfmt(kV, 4)} sin escalar y ${nfmt(kS, 4)} escalado: una perturbación relativa ${nfmt(relY)} cambia los coeficientes en potencias de t por un factor ${nfmt(relCraw / relY, 3)} pero la predicción solo por ${nfmt(relPred / relY, 3)}.` : `Con nodos de Chebyshev el error de Runge disminuye (${nfmt(spacing.at(-1).rc)}) mientras que con nodos uniformes crece (${nfmt(spacing.at(-1).ru)}).`}`;
  const physical = `Las lecturas faltantes se estiman, no se recuperan: el error máximo observado en t = ${hidden.join(' y ')} s es ${nfmt(maxErr)} u. (${nfmt(100 * maxErr / amp, 3)} % de la amplitud). La confiabilidad depende de la cobertura de los nodos, del ruido (σ = ${sigma} amplifica por ≈ ${sigma > 0 ? nfmt(rms(eP[0]) / sigma, 3) : '—'} en el primer punto) y de que la señal real sea suave; una curva ajustada no garantiza exactitud fuera de los puntos verificados.`;
  const summary = [
    { label: 'Muestras disponibles', value: String(xs.length), unit: 'nodos' }, { label: 'Pruebas ocultas', value: String(hidden.length), unit: 'puntos' },
    { label: 'Error máximo reconstrucción', value: nfmt(maxErr), unit: 'u.' }, { label: 'Ruido determinista', value: nfmt(noiseScale), unit: 'factor' },
    { label: 'κ₂ Vandermonde', value: nfmt(kV, 5), unit: '' }, { label: 'κ₂ escalado', value: nfmt(kS, 5), unit: '' },
  ];
  return { summary, sections, runs, metric: { label: 'Error máximo de reconstrucción', value: maxErr, unit: 'u.' }, numeric, physical,
    note: mal ? 'MAL CONDICIONADO: ensayo de escala de nodos y de sensibilidad de coeficientes; no es un fallo comprobado de sensores.' : 'Señal sintética s(t) = A·sen(t), no telemetría real.',
    plots: sections.flatMap((s) => s.plots), tables: sections.flatMap((s) => s.tables), extra: { kV, kS, rootOk } };
}
