// Pruebas de actualización dinámica: los resultados y gráficos deben derivar SIEMPRE de los parámetros actuales.
// Ejecutar: node tests/test-dinamico.mjs
import assert from 'node:assert/strict';
import { CASES, SCENARIOS, PRESETS, PARAM_DEFS, simulateCase } from '../assets/cases/index.js';
import { Database, MemoryAdapter } from '../assets/db/engine.js';
import * as Repo from '../assets/db/repo.js';
import { toDraft, changedFields, isDirty, parseDraft } from '../assets/ui/draft.js';

let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const near = (a, b, tol, m) => { assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${m}: ${a} vs ${b}`); n++; };
const section = (t) => console.log(`\n▶ ${t}`);
const sig = (o) => JSON.stringify(o, (k, v) => (typeof v === 'number' ? Number(v.toPrecision(12)) : v));
const plots = (r) => r.sections.flatMap((s) => s.plots);
const plot = (r, prefix) => plots(r).find((p) => p.title.startsWith(prefix));
const ser = (p, prefix) => p.series.find((s) => s.name.startsWith(prefix)).points;
const everything = (r) => sig({ s: r.summary, m: r.metric, n: r.numeric, f: r.physical, p: plots(r).map((p) => p.series), t: r.sections.flatMap((s) => s.tables.map((t) => { const skip = t.headers.map((h, i) => (/\bms\b|tiempo/i.test(h) ? i : -1)).filter((i) => i >= 0); return t.rows.map((row) => row.filter((_, i) => !skip.includes(i))); })), runs: r.runs.map((x) => x.summary) });
const baseOf = (id) => PRESETS[id].NORMAL;
const presetSnapshot = sig(PRESETS);

/* ---------- 1. Los parámetros actuales llegan al cálculo y a los resultados ---------- */
section('Cada parámetro modificado llega al modelo (no se usan valores predeterminados)');
const INERT = { '3:omega': 'NORMAL tiene F₀ = 0: vibración libre, la frecuencia de excitación no interviene' };
for (const c of CASES) {
  const base = simulateCase(c.id, 'NORMAL', baseOf(c.id)), baseAll = everything(base);
  for (const d of PARAM_DEFS[c.id].filter((x) => x.type !== 'select')) {
    const p = { ...baseOf(c.id) }; let v = p[d.key] * 1.25 || d.max * 0.3; if (v > d.max) v = p[d.key] * 0.8; if (v < d.min) v = d.min; p[d.key] = v;
    const r = simulateCase(c.id, 'NORMAL', p);
    ok(r.params[d.key] === v, `${c.short}/${d.key}: los parámetros del resultado son los actuales`);
    if (INERT[`${c.id}:${d.key}`]) ok(everything(r) === baseAll, `${c.short}/${d.key}: sin efecto matemático (${INERT[`${c.id}:${d.key}`]})`);
    else ok(everything(r) !== baseAll, `${c.short}/${d.key}: el cambio debe alterar los resultados`);
  }
}
{ const f = simulateCase(3, 'ESTRÉS', PRESETS[3]['ESTRÉS']), g = simulateCase(3, 'ESTRÉS', { ...PRESETS[3]['ESTRÉS'], omega: 1.5 });
  ok(sig(plot(f, 'Desplazamiento').series) !== sig(plot(g, 'Desplazamiento').series), 'caso 3: con fuerza externa ω sí modifica la trayectoria'); }

section('Gráficos que deben cambiar y gráficos que, por el modelo, no cambian');
{ const b = simulateCase(1, 'NORMAL', baseOf(1));
  const t = simulateCase(1, 'NORMAL', { ...baseOf(1), tr: 3 }), v = simulateCase(1, 'NORMAL', { ...baseOf(1), v0: 20 });
  ok(sig(plot(t, 'Velocidad').series) === sig(plot(b, 'Velocidad').series), 'caso 1: tᵣ no altera v(t) del tramo de frenado');
  ok(sig(plot(t, 'Distribución Monte Carlo').series) !== sig(plot(b, 'Distribución Monte Carlo').series), 'caso 1: tᵣ sí desplaza la distribución de d_total');
  ok(t.metric.value > b.metric.value, 'caso 1: más reacción, más distancia total');
  ok(sig(plot(v, 'Velocidad').series) !== sig(plot(b, 'Velocidad').series) && sig(plot(v, 'Posición').series) !== sig(plot(b, 'Posición').series), 'caso 1: v₀ cambia velocidad y posición'); }
{ const b = simulateCase(2, 'NORMAL', baseOf(2));
  const x0 = simulateCase(2, 'NORMAL', { ...baseOf(2), x0: 5 }), th = simulateCase(2, 'NORMAL', { ...baseOf(2), threshold: 0.5 });
  ok(sig(plot(x0, 'Evolución').series) === sig(plot(b, 'Evolución').series), 'caso 2: la semilla de Newton no altera D(t)');
  ok(sig(x0.runs.find((r) => r.method === 'Newton-Raphson').iterations) !== sig(b.runs.find((r) => r.method === 'Newton-Raphson').iterations), 'caso 2: la semilla sí cambia las iteraciones de Newton');
  ok(th.metric.value > b.metric.value && sig(plot(th, 'Evolución').series) !== sig(plot(b, 'Evolución').series), 'caso 2: umbral mayor, raíz mayor y curva de umbral distinta'); }
{ const b = simulateCase(4, 'NORMAL', baseOf(4)), th = simulateCase(4, 'NORMAL', { ...baseOf(4), theta: 0.3 }), am = simulateCase(4, 'NORMAL', { ...baseOf(4), amp: 2 });
  ok(sig(plot(th, 'Reconstrucción').series) === sig(plot(b, 'Reconstrucción').series), 'caso 4: θ no altera la reconstrucción');
  ok(sig(plot(am, 'Reconstrucción').series) !== sig(plot(b, 'Reconstrucción').series), 'caso 4: la amplitud sí cambia la señal reconstruida'); }

/* ---------- 2. Cambiar de escenario recalcula todo ---------- */
section('NORMAL, ESTRÉS y MAL CONDICIONADO producen resultados propios');
for (const c of CASES) {
  const all = SCENARIOS.map((s) => simulateCase(c.id, s, PRESETS[c.id][s]));
  all.forEach((r, i) => ok(sig(r.params) === sig(PRESETS[c.id][SCENARIOS[i]]) && r.scenario === SCENARIOS[i], `${c.short}/${SCENARIOS[i]}: parámetros y escenario correctos`));
  ok(new Set(all.map(everything)).size === 3, `${c.short}: los tres escenarios dan resultados distintos`);
  ok(new Set(all.map((r) => sig(plots(r).map((p) => p.series)))).size === 3, `${c.short}: los tres escenarios dan gráficos distintos`);
}

/* ---------- 3. Sin estado compartido ni caché entre ejecuciones ---------- */
section('Aislamiento entre ejecuciones');
for (const c of CASES) {
  const A = baseOf(c.id), B = { ...A, [PARAM_DEFS[c.id][0].key]: PARAM_DEFS[c.id][0].min + (PARAM_DEFS[c.id][0].max - PARAM_DEFS[c.id][0].min) * 0.4 };
  const a1 = everything(simulateCase(c.id, 'NORMAL', A)); const rb = simulateCase(c.id, 'NORMAL', B); const b1 = everything(rb);
  ok(everything(simulateCase(c.id, 'NORMAL', A)) === a1, `${c.short}: A → B → A devuelve A idéntico`);
  plots(rb).forEach((p) => p.series.forEach((s) => { s.points.length = 0; s.points.push([0, 0]); })); rb.metric.value = -1; rb.params[PARAM_DEFS[c.id][0].key] = -999;
  ok(everything(simulateCase(c.id, 'NORMAL', B)) === b1, `${c.short}: mutar un resultado no contamina la siguiente ejecución`);
  ok(sig(A) === sig(baseOf(c.id)), `${c.short}: los parámetros de entrada no se modifican`);
}
ok(sig(PRESETS) === presetSnapshot, 'los valores predeterminados siguen intactos tras todas las ejecuciones');

/* ---------- 4. Gráficos coherentes con las fórmulas y las tablas ---------- */
section('Los puntos de los gráficos coinciden con los valores numéricos');
{ const p = { v0: 16, a: 2.5, tr: 2, h: 0.5, c: 0.2, dAvail: 90 }, r = simulateCase(1, 'NORMAL', { ...baseOf(1), ...p }), T = p.v0 / p.a, dB = p.v0 ** 2 / (2 * p.a);
  for (const [t, v] of ser(plot(r, 'Velocidad'), 'Referencia')) near(v, p.v0 - p.a * t, 1e-9, 'v(t) del gráfico');
  for (const [t, x] of ser(plot(r, 'Posición'), 'Referencia')) near(x, p.v0 * t - 0.5 * p.a * t * t, 1e-9, 'x(t) del gráfico');
  near(ser(plot(r, 'Posición'), 'RK4').at(-1)[1], dB, 1e-9, 'x(T) RK4 del gráfico = v₀²/(2a)');
  near(r.runs.find((x) => x.method === 'RK4').summary.value[0], ser(plot(r, 'Posición'), 'RK4').at(-1)[1], 1e-12, 'tabla RK4 = último punto del gráfico');
  near(r.runs.find((x) => x.method === 'Newton-Raphson').summary.value, T, 1e-8, 't_det de Newton');
  near(r.metric.value, dB + p.v0 * p.tr, 1e-9, 'métrica: distancia total'); near(Number(r.summary.find((s) => s.label === 'Distancia de reacción').value), p.v0 * p.tr, 1e-9, 'distancia de reacción'); }
{ const p = { D0: 0.1, alpha: 0.03, beta: 0.0008, threshold: 0.7, tMax: 30 }, r = simulateCase(2, 'NORMAL', { ...baseOf(2), ...p });
  const tstar = (-p.alpha + Math.sqrt(p.alpha ** 2 + 4 * p.beta * (p.threshold - p.D0))) / (2 * p.beta), pl = plot(r, 'Evolución');
  for (const [t, d] of ser(pl, 'D(t)')) near(d, p.D0 + p.alpha * t + p.beta * t * t, 1e-9, 'D(t) del gráfico');
  ok(ser(pl, 'Umbral').every(([, y]) => y === p.threshold), 'la recta de umbral usa el umbral actual');
  near(ser(pl, 't*')[0][0], tstar, 1e-9, 't* del gráfico'); near(r.metric.value, tstar, 1e-9, 'métrica t*');
  for (const m of ['Bisección', 'Newton-Raphson', 'Secante']) near(r.runs.find((x) => x.method === m).summary.value, tstar, 1e-7, `${m}: raíz`); }
{ const p = { ...baseOf(3), m: 400, c: 120, k: 3000, F0: 0, x0: 0.2, vInit: 0.5, h: 0.05, T: 8 }, r = simulateCase(3, 'NORMAL', p);
  const w0 = Math.sqrt(p.k / p.m), z = p.c / (2 * Math.sqrt(p.k * p.m)), wd = w0 * Math.sqrt(1 - z * z), C2 = (p.vInit + z * w0 * p.x0) / wd, pl = plot(r, 'Desplazamiento');
  for (const [t, x] of ser(pl, 'Referencia')) near(x, Math.exp(-z * w0 * t) * (p.x0 * Math.cos(wd * t) + C2 * Math.sin(wd * t)), 1e-9, 'x(t) analítica del gráfico');
  near(ser(pl, 'Referencia')[0][1], p.x0, 1e-12, 'x(0) = x₀ actual'); near(ser(pl, 'Referencia').at(-1)[0], p.T, 1e-9, 'la ventana llega a T actual');
  ok(Math.max(...ser(pl, 'RK4').map(([, x]) => Math.abs(x))) >= p.x0 - 1e-12, 'RK4 parte de x₀ actual');
  near(ser(pl, 'RK4')[0][1], p.x0, 1e-12, 'RK4 también parte de x₀ actual'); }
{ const p = { ...baseOf(4), amp: 1.7, test1: 0.6, test2: 1.4 }, r = simulateCase(4, 'NORMAL', p), pl = plot(r, 'Reconstrucción');
  for (const [t, y] of ser(pl, 'Señal exacta')) near(y, p.amp * Math.sin(t), 1e-9, 'señal exacta del gráfico');
  ok(sig(ser(pl, 'Datos ocultados').map(([t]) => t)) === sig([p.test1, p.test2]), 'los datos ocultados son los actuales');
  const nodes = ser(pl, 'Nodos conocidos'), lag = (t) => nodes.reduce((s, [xi, yi], i) => s + yi * nodes.reduce((q, [xj], j) => (j === i ? q : q * (t - xj) / (xi - xj)), 1), 0);
  near(r.runs.find((x) => x.method === 'Lagrange').summary.value[0], lag(p.test1), 1e-9, 'predicción de Lagrange en la tabla = Lagrange sobre los nodos del gráfico');
  for (const [t, y] of ser(pl, 'Polinomio')) { if (Math.abs(t - nodes[1][0]) < 1e-12) near(y, nodes[1][1], 1e-9, 'el polinomio pasa por los nodos'); } }

/* ---------- 5. Borrador del formulario ---------- */
section('Detección de cambios en el formulario');
{ const defs = PARAM_DEFS[1], p = baseOf(1), d = toDraft(p);
  ok(!isDirty(defs, d, p), 'sin edición no hay cambios'); d.v0 = '25';
  ok(isDirty(defs, d, p) && changedFields(defs, d, p)[0].key === 'v0' && changedFields(defs, d, p)[0].to === '25', 'editar v₀ marca el resultado como desactualizado');
  d.v0 = String(p.v0); ok(!isDirty(defs, d, p), 'volver al valor original quita la marca'); d.a = ''; ok(isDirty(defs, d, p), 'un campo vacío cuenta como cambio');
  assert.throws(() => parseDraft(defs, d), /Completa el campo/); n++; d.a = '3'; ok(parseDraft(defs, d).a === 3, 'parseDraft devuelve los valores tecleados'); }

/* ---------- 6. Guardar, recuperar y relanzar con parámetros modificados ---------- */
section('Persistencia: guardar → recuperar → relanzar con los parámetros guardados');
const db = await new Database(new MemoryAdapter()).open(); await Repo.seedBase(db);
for (const c of CASES) for (const s of SCENARIOS) {
  const p = { ...PRESETS[c.id][s] }, k = PARAM_DEFS[c.id].find((x) => x.type !== 'select'); p[k.key] = Math.min(k.max, Math.max(k.min, p[k.key] * 1.1 || k.min));
  const r = simulateCase(c.id, s, p), id = await Repo.saveSimulation(db, r), { result } = Repo.loadSimulation(db, id);
  const esc = db.get('escenario', db.get('simulacion', id).escenario_id), saved = JSON.parse(esc.parametros_json);
  ok(sig(saved) === sig(p) && saved[k.key] === p[k.key], `${c.short}/${s}: los parámetros guardados son los modificados`);
  near(result.metric.value, r.metric.value, 1e-9, `${c.short}/${s}: métrica recuperada`); for (const key of Object.keys(p)) near(result.params[key], p[key], 1e-9, `${c.short}/${s}: parámetro recuperado ${key}`);
  ok(everything(simulateCase(c.id, s, saved)) === everything(r), `${c.short}/${s}: relanzar con los parámetros guardados reproduce la ejecución`);
  ok((await Repo.verifySimulation(db, id, 1e-9)).ok, `${c.short}/${s}: verificación dentro de tolerancia`);
}
console.log(`\n✔ OK · ${n} comprobaciones de actualización dinámica aprobadas.`);
