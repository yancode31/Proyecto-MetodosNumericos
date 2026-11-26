/** Repositorio: guarda una simulación completa en la BD relacional y la recupera / reproduce. */
import { TABLES } from './schema.js';
import { simulateCase, CASES, PRESETS, SCENARIOS, ENGINE_VERSION } from '../cases/index.js';

const MAX_ITER_ROWS = 80;
const thinList = (list, max) => { if (list.length <= max) return list; const out = []; for (let i = 0; i < max; i++) out.push(list[Math.round((i * (list.length - 1)) / (max - 1))]); return out; };
const finite = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const jsonSafe = (o) => JSON.stringify(o, (_, v) => (typeof v === 'number' && !Number.isFinite(v) ? null : v));
/** Instantánea compacta: sin `runs` (viven en tablas), números a 10 cifras y series de gráficos reducidas. */
function compactSnapshot(result) {
  const { runs, ...rest } = result;
  const small = (pl) => ({ ...pl, series: (pl.series || []).map((s) => ({ ...s, points: thinList(s.points || [], 160) })) });
  const snap = { ...rest, sections: result.sections.map((sc) => ({ ...sc, plots: sc.plots.map(small) })), runMeta: runs.map((r) => ({ family: r.family, method: r.method, nIter: r.iterations.length })) };
  delete snap.plots; delete snap.tables;
  return JSON.stringify(snap, (_, v) => (typeof v === 'number' ? (Number.isFinite(v) ? Number(v.toPrecision(10)) : null) : v));
}

export async function seedBase(db) {
  await db.transaction(async () => {
    for (const c of CASES) if (!db.get('caso_estudio', c.id)) db.insert('caso_estudio', { id: c.id, nombre: c.name, modelo_version: ENGINE_VERSION, descripcion: c.description });
    for (const c of CASES) for (const s of SCENARIOS) ensureScenario(db, c.id, s, PRESETS[c.id][s]);
  });
}
export function ensureScenario(db, caseId, tipo, params) {
  const pj = JSON.stringify(params);
  const hit = db.find('escenario', (e) => e.caso_id === caseId && e.tipo === tipo && e.parametros_json === pj)[0];
  if (hit) return hit;
  return db.insert('escenario', { caso_id: caseId, tipo, parametros_json: pj, fuente_datos: 'sintética educativa' });
}

/** Guarda: escenario → simulación → ejecuciones → iteraciones → resúmenes. Devuelve el id de la simulación. */
export async function saveSimulation(db, result, { etiqueta = null, notas = null, equipo = 'Equipo SIMTELE-RISK' } = {}) {
  return db.transaction(async () => {
    const esc = ensureScenario(db, result.caseId, result.scenario, result.params);
    const sim = db.insert('simulacion', {
      escenario_id: esc.id, fecha: new Date().toISOString(), usuario_equipo: equipo, estado: 'COMPLETADA', etiqueta, notas, version_motor: result.engine || ENGINE_VERSION,
      metrica_nombre: result.metric.label, metrica_valor: finite(result.metric.value), metrica_unidad: result.metric.unit,
      duracion_ms: finite(result.runs.reduce((s, r) => s + (r.timeMs || 0), 0)), snapshot_json: compactSnapshot(result),
    }, { silent: true });
    for (const run of result.runs) {
      const ex = db.insert('ejecucion_metodo', { simulacion_id: sim.id, familia: run.family, metodo: run.method, tolerancia: finite(run.tolerance), paso: finite(run.step), max_iter: run.maxIter ?? null, convergio: run.converged ? 1 : 0, tiempo_ms: finite(run.timeMs) }, { silent: true });
      const its = thinList(run.iterations, MAX_ITER_ROWS), seen = new Set();
      its.forEach((it, i) => {
        let n = Number.isInteger(it.k) ? it.k : i; if (seen.has(n)) n = 100000 + i; seen.add(n);
        db.insert('iteracion_resultado', { ejecucion_id: ex.id, numero: n, aproximacion_json: jsonSafe(it.approx ?? null), residual: finite(it.residual), error_abs: finite(it.error_abs), error_rel: finite(it.error_rel) }, { silent: true });
      });
      db.insert('resultado_resumen', { ejecucion_id: ex.id, referencia: run.summary.reference ?? null, valor_json: jsonSafe(run.summary.value ?? null), metrica_error_json: jsonSafe(run.summary.metrics || {}), interpretacion: run.summary.interpretation || null }, { silent: true });
    }
    db._audit('simulacion', sim.id, 'INSERT', `Simulación guardada: caso ${result.caseId}, ${result.scenario}, ${result.runs.length} ejecuciones`);
    return sim.id;
  }, { audit: false });
}

export function listSimulations(db) {
  return db.all('simulacion').map((s) => { const e = db.get('escenario', s.escenario_id); const ver = db.find('verificacion', (v) => v.simulacion_id === s.id).sort((a, b) => b.id - a.id)[0]; return { ...s, caso_id: e.caso_id, tipo: e.tipo, params: JSON.parse(e.parametros_json), metodos: db.find('ejecucion_metodo', (m) => m.simulacion_id === s.id).length, verificacion: ver || null }; }).sort((a, b) => b.id - a.id);
}
/** Recupera la simulación guardada: instantánea + iteraciones reconstruidas desde las tablas relacionales. */
export function loadSimulation(db, id) {
  const s = db.get('simulacion', id); if (!s) throw Error(`No existe la simulación ${id}.`);
  const result = JSON.parse(s.snapshot_json);
  result.plots = result.sections.flatMap((x) => x.plots); result.tables = result.sections.flatMap((x) => x.tables);
  const runs = db.find('ejecucion_metodo', (m) => m.simulacion_id === id).map((m) => ({
    ...m, iteraciones: db.find('iteracion_resultado', (i) => i.ejecucion_id === m.id).sort((a, b) => a.numero - b.numero),
    resumen: db.find('resultado_resumen', (r) => r.ejecucion_id === m.id)[0] || null,
  }));
  result.runs = runs.map((m, i) => ({ family: m.familia, method: m.metodo, iterations: { length: result.runMeta?.[i]?.nIter ?? m.iteraciones.length }, summary: { value: m.resumen ? JSON.parse(m.resumen.valor_json) : null, reference: m.resumen?.referencia } }));
  return { sim: s, result, runs };
}
/** Compara dos listas de ejecuciones (valor final, residual y error) dentro de una tolerancia. */
export function compareRuns(storedRuns, freshRuns, tol = 1e-9) {
  const rows = [];
  const flat = (v) => (Array.isArray(v) ? v.flat(Infinity).filter((x) => typeof x === 'number') : typeof v === 'number' ? [v] : []);
  for (let i = 0; i < Math.max(storedRuns.length, freshRuns.length); i++) {
    const a = storedRuns[i], b = freshRuns[i];
    if (!a || !b || a.method !== b.method) { rows.push({ metodo: a?.method ?? b?.method, diff: Infinity, ok: false, nota: 'Estructura distinta' }); continue; }
    const va = flat(a.summary.value), vb = flat(b.summary.value);
    let diff = 0; for (let j = 0; j < Math.max(va.length, vb.length); j++) diff = Math.max(diff, Math.abs((va[j] ?? 0) - (vb[j] ?? 0)) / Math.max(1, Math.abs(va[j] ?? 0)));
    const ia = a.iterations.length, ib = b.iterations.length;
    rows.push({ metodo: a.method, familia: a.family, diff, ok: diff <= tol && ia === ib, iter_guardadas: ia, iter_nuevas: ib });
  }
  return { rows, ok: rows.every((r) => r.ok), maxDiff: Math.max(0, ...rows.map((r) => r.diff)), tol };
}
/** Reproduce la simulación almacenada con sus parámetros y la compara con lo guardado. */
export async function verifySimulation(db, id, tol = 1e-9, { record = true } = {}) {
  const { result } = loadSimulation(db, id);
  const e = db.get('escenario', db.get('simulacion', id).escenario_id);
  const fresh = simulateCase(e.caso_id, e.tipo, JSON.parse(e.parametros_json));
  const cmp = compareRuns(result.runs, fresh.runs, tol);
  const metricDiff = Math.abs(fresh.metric.value - result.metric.value) / Math.max(1, Math.abs(result.metric.value));
  cmp.metricDiff = metricDiff; cmp.ok = cmp.ok && metricDiff <= tol;
  if (record) await db.transaction(async () => { db.insert('verificacion', { simulacion_id: id, fecha: new Date().toISOString(), tolerancia: tol, aprobada: cmp.ok ? 1 : 0, detalle_json: JSON.stringify({ metricDiff, maxDiff: cmp.maxDiff, metodos: cmp.rows.length }) }, { silent: true }); });
  return { ...cmp, fresh, stored: result };
}
export async function updateSimulationMeta(db, id, patch) { return db.update('simulacion', id, patch, { audit: true }); }
export async function deleteSimulation(db, id) { return db.delete('simulacion', id, { audit: true }); }
export async function seedReference(db, onProgress) {
  const ids = [];
  for (const c of CASES) for (const s of SCENARIOS) {
    const exists = db.find('simulacion', (x) => x.etiqueta === `Referencia · ${c.short} · ${s}`)[0];
    if (exists) continue;
    ids.push(await saveSimulation(db, simulateCase(c.id, s, PRESETS[c.id][s]), { etiqueta: `Referencia · ${c.short} · ${s}`, notas: 'Experimento de referencia con parámetros del informe.' }));
    onProgress?.(ids.length);
  }
  return ids;
}
export { TABLES };
