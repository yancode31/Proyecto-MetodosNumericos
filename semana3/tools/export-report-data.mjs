// Exporta los 12 experimentos a JSON (fuente única de tablas y gráficos del informe).
import { writeFileSync } from 'node:fs';
import { runSelfChecks } from '../assets/core/selfcheck.js';
import { Database, MemoryAdapter } from '../assets/db/engine.js';
import * as Repo from '../assets/db/repo.js';
import { CASES, SCENARIOS, PRESETS, PARAM_DEFS, simulateCase } from '../assets/cases/index.js';
const out = { cases: CASES, params: PARAM_DEFS, experiments: [] };
for (const c of CASES) for (const s of SCENARIOS) {
  const r = simulateCase(c.id, s, PRESETS[c.id][s]);
  out.experiments.push({ caseId: c.id, scenario: s, params: r.params, summary: r.summary, metric: r.metric, numeric: r.numeric, physical: r.physical, note: r.note, sections: r.sections,
    runs: r.runs.map((x) => ({ family: x.family, method: x.method, tolerance: x.tolerance, step: x.step, converged: x.converged, n: x.iterations.length, value: x.summary.value, reference: x.summary.reference, metrics: x.summary.metrics })) });
}
out.selfchecks = runSelfChecks();
const db = await new Database(new MemoryAdapter()).open(); await Repo.seedBase(db); await Repo.seedReference(db);
out.verif = []; for (const sim of Repo.listSimulations(db).reverse()) { const v = await Repo.verifySimulation(db, sim.id, 1e-9); out.verif.push({ id: sim.id, caseId: sim.caso_id, scenario: sim.tipo, methods: v.rows.length, maxDiff: v.maxDiff, metricDiff: v.metricDiff, ok: v.ok, iters: db.find('iteracion_resultado', (i) => db.get('ejecucion_metodo', i.ejecucion_id).simulacion_id === sim.id).length }); }
out.dbStats = db.stats();
writeFileSync(process.argv[2] || 'data.json', JSON.stringify(out));
console.log('exportado', out.experiments.length);
