// Exporta los resultados de la app web (JavaScript) para compararlos con la implementación independiente en Python.
import { writeFileSync } from 'node:fs';
import { CASES, SCENARIOS, PRESETS, simulateCase } from '../assets/cases/index.js';
const out = [];
for (const c of CASES) for (const s of SCENARIOS) {
  const r = simulateCase(c.id, s, PRESETS[c.id][s]);
  const runs = {}; for (const x of r.runs) runs[x.method] = { valor: x.summary.value, iter: x.summary.metrics?.iteraciones ?? null };
  out.push({ caso: c.id, escenario: s, metrica: r.metric.value, runs });
}
writeFileSync(new URL('../../python/tests/referencia_js.json', import.meta.url), JSON.stringify(out));
console.log('referencia exportada:', out.length, 'experimentos');
