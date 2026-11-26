// Pruebas automáticas SIMTELE-RISK: matemática, base de datos relacional, SQL y persistencia. Ejecutar: node tests/test-all.mjs
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CASES, SCENARIOS, PRESETS, simulateCase, validate, COVERAGE } from '../assets/cases/index.js';
import { runSelfChecks } from '../assets/core/selfcheck.js';
import { Database, MemoryAdapter, DBError } from '../assets/db/engine.js';
import { SQL } from '../assets/db/sql.js';
import * as Repo from '../assets/db/repo.js';
import { TABLE_ORDER } from '../assets/db/schema.js';

let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const section = (t) => console.log(`\n▶ ${t}`);

section('Verificaciones matemáticas independientes');
const checks = runSelfChecks();
for (const c of checks) ok(c.ok, `${c.family}: ${c.name} (esperado ${c.expected}, obtenido ${c.got})`);
console.log(`  ${checks.length} verificaciones correctas`);

section('12 experimentos (4 casos × 3 escenarios)');
for (const c of CASES) for (const s of SCENARIOS) {
  const r = simulateCase(c.id, s, PRESETS[c.id][s]);
  ok(r.runs.length >= 5 && r.sections.length >= 3, `${c.short}/${s}: secciones y ejecuciones`);
  ok(r.plots.length >= 2, `${c.short}/${s}: al menos dos gráficos`);
  ok(Number.isFinite(r.metric.value), `${c.short}/${s}: métrica finita`);
  ok(r.numeric.length > 50 && r.physical.length > 50, `${c.short}/${s}: dos conclusiones distintas`);
  ok(r.numeric !== r.physical, 'conclusiones diferenciadas');
  const again = simulateCase(c.id, s, PRESETS[c.id][s]);
  ok(JSON.stringify(again.runs.map((x) => x.summary.value)) === JSON.stringify(r.runs.map((x) => x.summary.value)), `${c.short}/${s}: determinista (semillas fijas)`);
}
const fam = new Set(); for (const c of CASES) for (const s of SCENARIOS) simulateCase(c.id, s, PRESETS[c.id][s]).runs.forEach((x) => fam.add(x.family));
for (const f of ['Raíces', 'Sistemas lineales', 'Integración', 'EDO', 'Interpolación']) ok(fam.has(f), `familia ${f} ejecutada`);
const methodsRun = new Set(); for (const c of CASES) for (const s of SCENARIOS) simulateCase(c.id, s, PRESETS[c.id][s]).runs.forEach((x) => methodsRun.add(x.method));
for (const m of ['Bisección', 'Newton-Raphson', 'Secante', 'Jacobi', 'Gauss-Seidel', 'LU', 'Gradiente conjugado', 'Lagrange', 'Newton (dif. divididas)', 'Spline cúbico natural', 'Trapecio compuesto', 'Simpson 1/3 compuesto', 'Romberg', 'RK2 (punto medio)', 'RK4']) ok(methodsRun.has(m), `método obligatorio presente: ${m}`);
console.log('  todos los métodos obligatorios se ejecutan');

section('Validación de entradas');
for (const id of [1, 2, 3, 4]) { const bad = { ...PRESETS[id].NORMAL }; bad[Object.keys(bad)[0]] = NaN; assert.throws(() => simulateCase(id, 'NORMAL', bad)); n++; }
assert.throws(() => simulateCase(2, 'NORMAL', { ...PRESETS[2].NORMAL, threshold: 0.01 })); n++;
assert.throws(() => simulateCase(4, 'NORMAL', { ...PRESETS[4].NORMAL, test1: 0.5 })); n++;
assert.throws(() => simulateCase(1, 'OTRO', PRESETS[1].NORMAL)); n++;

section('Base de datos: restricciones');
const mem = new MemoryAdapter(); let db = await new Database(mem).open(); await Repo.seedBase(db);
ok(db.count('caso_estudio') === 4 && db.count('escenario') === 12, 'semilla de 4 casos y 12 escenarios');
await assert.rejects(db.insert('escenario', { caso_id: 99, tipo: 'NORMAL', parametros_json: '{}' }), DBError); n++;
await assert.rejects(db.insert('escenario', { caso_id: 1, tipo: 'RARO', parametros_json: '{}' }), DBError); n++;
await assert.rejects(db.insert('escenario', { caso_id: 1, tipo: 'NORMAL', parametros_json: 'no-json' }), DBError); n++;
await assert.rejects(db.insert('caso_estudio', { id: 1, nombre: 'Duplicado' }), DBError); n++;
await assert.rejects(db.insert('caso_estudio', { id: 9, nombre: 'Detención de emergencia' }), DBError); n++;
await assert.rejects(db.delete('escenario', 1).then(() => db.insert('simulacion', { escenario_id: 1, fecha: 'x' })), DBError); n++;

section('Guardar → reiniciar → recuperar → repetir → comparar');
await Repo.seedBase(db); // por si el rechazo anterior retiró el escenario
const ids = await Repo.seedReference(db);
ok(ids.length === 12, '12 simulaciones guardadas');
db = await new Database(mem).open(); // “reinicio”: nueva conexión sobre el mismo almacenamiento
ok(db.count('simulacion') === 12 && db.count('iteracion_resultado') > 1000, 'datos recuperados tras reabrir');
for (const id of db.all('simulacion').map((s) => s.id)) { const v = await Repo.verifySimulation(db, id, 1e-9); ok(v.ok, `simulación #${id} reproducida dentro de tolerancia`); }
ok(db.count('verificacion') === 12, 'verificaciones registradas');
ok(db.integrityCheck().length === 0, 'sin violaciones de integridad');
const nextId = db.nextId('simulacion'); const added = await Repo.saveSimulation(db, simulateCase(2, 'NORMAL', PRESETS[2].NORMAL)); ok(added === nextId, 'autoincremento continúa tras reabrir');

section('Persistencia en archivo (otro proceso)');
const file = join(tmpdir(), 'simtele_test_db.json'); if (existsSync(file)) rmSync(file);
class FileAdapter { constructor(p) { this.p = p; } async load() { return existsSync(this.p) ? JSON.parse(readFileSync(this.p, 'utf8')) : { tables: {}, meta: {} }; } async commit(ch, meta) { const s = await this.load(); for (const c of ch) { const t = (s.tables[c.table] ||= {}); if (c.op === 'put') t[c.row[Object.keys(c.row)[0]]] = c.row; else delete t[c.id]; } s.meta = meta; writeFileSync(this.p, JSON.stringify(s)); } async clear() { if (existsSync(this.p)) rmSync(this.p); } }
let fdb = await new Database(new FileAdapter(file)).open(); await Repo.seedBase(fdb); const fid = await Repo.saveSimulation(fdb, simulateCase(3, 'ESTRÉS', PRESETS[3]['ESTRÉS']));
fdb = await new Database(new FileAdapter(file)).open(); ok(fdb.count('simulacion') === 1, 'archivo: simulación persistida'); ok((await Repo.verifySimulation(fdb, fid, 1e-9)).ok, 'archivo: reproducción coincide'); rmSync(file);

section('CRUD, cascada y auditoría');
const sid = db.all('simulacion')[0].id, c = db.cascadeCount('simulacion', sid);
ok(c.ejecucion_metodo > 0 && c.iteracion_resultado > 0, 'conteo de cascada');
await Repo.updateSimulationMeta(db, sid, { etiqueta: 'Etiqueta de prueba', notas: 'nota' });
ok(db.get('simulacion', sid).etiqueta === 'Etiqueta de prueba', 'UPDATE');
await assert.rejects(db.update('simulacion', sid, { estado: 'INVALIDO' }), DBError); n++;
await assert.rejects(db.update('simulacion', sid, { id: 999 }), DBError); n++;
const before = db.count('ejecucion_metodo'); await Repo.deleteSimulation(db, sid);
ok(db.count('ejecucion_metodo') === before - c.ejecucion_metodo, 'DELETE en cascada');
ok(db.find('iteracion_resultado', (i) => !db.data.ejecucion_metodo.has(i.ejecucion_id)).length === 0, 'sin iteraciones huérfanas');
ok(db.count('auditoria') >= 2, 'auditoría registrada');
// rollback
const cnt = db.count('caso_estudio'); await assert.rejects(db.transaction(async () => { db.insert('caso_estudio', { id: 50, nombre: 'Temporal' }); db.insert('caso_estudio', { id: 51, nombre: 'Detención de emergencia' }); }), DBError); ok(db.count('caso_estudio') === cnt, 'rollback de transacción'); 

section('Intérprete SQL');
const q = new SQL(db);
let r = await q.exec('SELECT c.nombre, COUNT(*) AS n FROM simulacion s JOIN escenario e ON e.id = s.escenario_id JOIN caso_estudio c ON c.id = e.caso_id GROUP BY c.nombre ORDER BY c.nombre'); ok(r.rows.length === 4, 'JOIN + GROUP BY'); ok(r.rows.reduce((s, x) => s + x[1], 0) === db.count('simulacion'), 'suma de grupos');
r = await q.exec("SELECT metodo FROM ejecucion_metodo WHERE familia = 'Raíces' AND metodo LIKE 'Newton%' LIMIT 3"); ok(r.rows.length === 3 && r.rows.every((x) => x[0].startsWith('Newton')), 'WHERE/LIKE/LIMIT');
r = await q.exec('SELECT * FROM vw_resumen_simulaciones'); ok(r.rows.length === db.count('simulacion'), 'vista de resumen');
r = await q.exec("UPDATE simulacion SET notas = 'sql' WHERE etiqueta IS NULL"); ok(r.affected > 0, 'UPDATE por SQL');
r = await q.exec("INSERT INTO caso_estudio (id, nombre) VALUES (77, 'Caso extra')"); ok(db.get('caso_estudio', 77), 'INSERT por SQL');
r = await q.exec('DELETE FROM caso_estudio WHERE id = 77'); ok(!db.get('caso_estudio', 77), 'DELETE por SQL');
await assert.rejects(q.exec("INSERT INTO escenario (caso_id, tipo, parametros_json) VALUES (500, 'NORMAL', '{}')"), DBError); n++;
r = await q.exec('PRAGMA foreign_key_check'); ok(r.rows.length === 0, 'PRAGMA foreign_key_check');
const dump = db.exportSQL(); const db2 = await new Database(new MemoryAdapter()).open(); await new SQL(db2).importDump(dump);
ok(TABLE_ORDER.every((t) => db2.count(t) === db.count(t)), 'exportar SQL → importar SQL conserva todas las tablas');
const dbj = await new Database(new MemoryAdapter()).open(); await dbj.importJSON(JSON.parse(JSON.stringify(db.exportJSON()))); ok(TABLE_ORDER.every((t) => dbj.count(t) === db.count(t)), 'exportar JSON → importar JSON');
ok(COVERAGE.length >= 17, 'matriz de cobertura');
console.log(`\n✔ OK · ${n} comprobaciones automáticas aprobadas.`);
