-- SIMTELE-RISK · Semana 2 · SQLite relacional y persistencia de evidencias.
-- Ejecutado automáticamente desde server.py; los datos se guardan en database/simtele.db.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS caso_estudio (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  modelo_version TEXT NOT NULL DEFAULT 'semana2-v2'
);
CREATE TABLE IF NOT EXISTS escenario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caso_id INTEGER NOT NULL REFERENCES caso_estudio(id),
  tipo TEXT NOT NULL CHECK(tipo IN ('NORMAL','ESTRÉS','MAL CONDICIONADO')),
  parametros_json TEXT NOT NULL,
  fuente_datos TEXT NOT NULL DEFAULT 'sintéticos educativos'
);
CREATE TABLE IF NOT EXISTS simulacion (
  id TEXT PRIMARY KEY,
  escenario_id INTEGER NOT NULL REFERENCES escenario(id),
  fecha TEXT NOT NULL,
  usuario_equipo TEXT DEFAULT 'Equipo SIMTELE-RISK',
  estado TEXT NOT NULL DEFAULT 'COMPLETADA' CHECK(estado IN ('COMPLETADA','ERROR','EN_PROCESO')),
  modelo_version TEXT NOT NULL DEFAULT 'semana2-v2',
  snapshot_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ejecucion_metodo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  simulacion_id TEXT NOT NULL REFERENCES simulacion(id) ON DELETE CASCADE,
  metodo TEXT NOT NULL,
  tolerancia REAL,
  paso REAL,
  max_iter INTEGER,
  convergio INTEGER CHECK(convergio IN (0,1)),
  tiempo_ms REAL,
  headers_json TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS iteracion_resultado (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ejecucion_id INTEGER NOT NULL REFERENCES ejecucion_metodo(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  aproximacion_json TEXT NOT NULL,
  residual REAL,
  error_abs REAL,
  error_rel REAL,
  UNIQUE(ejecucion_id, numero)
);
CREATE TABLE IF NOT EXISTS resultado_resumen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ejecucion_id INTEGER NOT NULL UNIQUE REFERENCES ejecucion_metodo(id) ON DELETE CASCADE,
  referencia TEXT,
  valor_json TEXT NOT NULL,
  metrica_error_json TEXT,
  interpretacion TEXT
);
CREATE INDEX IF NOT EXISTS idx_sim_fecha ON simulacion(fecha);
CREATE INDEX IF NOT EXISTS idx_esc_caso ON escenario(caso_id,tipo);
CREATE INDEX IF NOT EXISTS idx_ejec_sim ON ejecucion_metodo(simulacion_id);
CREATE INDEX IF NOT EXISTS idx_iter_ejec ON iteracion_resultado(ejecucion_id,numero);
INSERT OR IGNORE INTO caso_estudio(id,nombre) VALUES
 (1,'Detención de emergencia'),(2,'Deterioro mecánico y mantenimiento'),
 (3,'Oscilaciones por viento'),(4,'Reconstrucción de sensores');
