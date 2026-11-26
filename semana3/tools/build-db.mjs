// Genera database/schema.sql y un volcado de demostración con los 12 experimentos de referencia.
// Uso: node tools/build-db.mjs   (luego: sqlite3 database/simtele_demo.sqlite < database/simtele_demo.sql)
import { writeFileSync } from 'node:fs';
import { Database, MemoryAdapter } from '../assets/db/engine.js';
import { fullDDL } from '../assets/db/schema.js';
import * as R from '../assets/db/repo.js';

const db = await new Database(new MemoryAdapter()).open();
await R.seedBase(db);
await R.seedReference(db);
for (const s of db.all('simulacion')) await R.verifySimulation(db, s.id, 1e-9);
writeFileSync(new URL('../database/schema.sql', import.meta.url), `-- SIMTELE-RISK · esquema relacional v2 (SQLite 3). Generado desde assets/db/schema.js\n${fullDDL()}\n` +
  `INSERT OR IGNORE INTO caso_estudio(id, nombre, modelo_version) VALUES\n${db.all('caso_estudio').map((c) => `  (${c.id}, '${c.nombre}', '${c.modelo_version}')`).join(',\n')};\n`);
writeFileSync(new URL('../database/simtele_demo.sql', import.meta.url), db.exportSQL());
console.log('OK:', Object.fromEntries(Object.entries(db.stats().tables).map(([k, v]) => [k, v.rows])));
