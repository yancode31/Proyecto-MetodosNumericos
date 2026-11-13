-- SIMTELE-RISK | Semana 1 | Diseño de persistencia relacional (SQLite)
-- Este archivo es un ESQUEMA PROPUESTO. La web estática de la Semana 1
-- utiliza IndexedDB local, no conecta directamente con SQLite.
-- Semana 2: implementar una API o servidor para utilizar estas tablas.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS caso_estudio (
    id INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    modelo_version TEXT NOT NULL DEFAULT 'semana1-v1'
);

CREATE TABLE IF NOT EXISTS escenario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    caso_id INTEGER NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('NORMAL','ESTRÉS','MAL CONDICIONADO')),
    parametros_json TEXT NOT NULL,
    fuente_datos TEXT NOT NULL DEFAULT 'sintética educativa',
    FOREIGN KEY (caso_id) REFERENCES caso_estudio(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS simulacion (
    id TEXT PRIMARY KEY,
    escenario_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    usuario_equipo TEXT,
    estado TEXT NOT NULL CHECK (estado IN ('COMPLETADA','ERROR','EN_PROCESO')),
    FOREIGN KEY (escenario_id) REFERENCES escenario(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS ejecucion_metodo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    simulacion_id TEXT NOT NULL,
    metodo TEXT NOT NULL,
    tolerancia REAL,
    paso REAL,
    max_iter INTEGER,
    convergio INTEGER CHECK (convergio IN (0,1)),
    tiempo_ms REAL,
    FOREIGN KEY (simulacion_id) REFERENCES simulacion(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS iteracion_resultado (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ejecucion_id INTEGER NOT NULL,
    numero INTEGER NOT NULL,
    aproximacion_json TEXT NOT NULL,
    residual REAL,
    error_abs REAL,
    error_rel REAL,
    UNIQUE (ejecucion_id, numero),
    FOREIGN KEY (ejecucion_id) REFERENCES ejecucion_metodo(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS resultado_resumen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ejecucion_id INTEGER NOT NULL UNIQUE,
    referencia TEXT,
    valor_json TEXT NOT NULL,
    metrica_error_json TEXT,
    interpretacion TEXT,
    FOREIGN KEY (ejecucion_id) REFERENCES ejecucion_metodo(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_escenario_caso ON escenario(caso_id,tipo);
CREATE INDEX IF NOT EXISTS idx_simulacion_fecha ON simulacion(fecha);
CREATE INDEX IF NOT EXISTS idx_metodo_simulacion ON ejecucion_metodo(simulacion_id);
CREATE INDEX IF NOT EXISTS idx_iteracion_ejecucion ON iteracion_resultado(ejecucion_id,numero);

INSERT OR IGNORE INTO caso_estudio(id,nombre) VALUES
 (1,'Detención de emergencia'),
 (2,'Deterioro mecánico y mantenimiento'),
 (3,'Oscilaciones por viento'),
 (4,'Reconstrucción de sensores');
