-- SIMTELE-RISK · esquema relacional v2 (SQLite 3). Generado desde assets/db/schema.js
PRAGMA foreign_keys = ON;

-- Los cuatro casos de estudio obligatorios.
CREATE TABLE IF NOT EXISTS caso_estudio (
    id INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    modelo_version TEXT NOT NULL DEFAULT 'semana3-v1.0',
    descripcion TEXT
);

-- Parámetros reproducibles de cada escenario (NORMAL, ESTRÉS, MAL CONDICIONADO).
CREATE TABLE IF NOT EXISTS escenario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    caso_id INTEGER NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('NORMAL', 'ESTRÉS', 'MAL CONDICIONADO')),
    parametros_json TEXT NOT NULL,
    fuente_datos TEXT NOT NULL DEFAULT 'sintética educativa',
    UNIQUE (caso_id, tipo, parametros_json),
    FOREIGN KEY (caso_id) REFERENCES caso_estudio(id) ON DELETE CASCADE
);

-- Una ejecución del laboratorio: escenario, fecha, estado y copia verificable del resultado.
CREATE TABLE IF NOT EXISTS simulacion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    escenario_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    usuario_equipo TEXT DEFAULT 'Equipo SIMTELE-RISK',
    estado TEXT NOT NULL DEFAULT 'COMPLETADA' CHECK (estado IN ('COMPLETADA', 'ERROR', 'EN_PROCESO')),
    etiqueta TEXT,
    notas TEXT,
    version_motor TEXT,
    metrica_nombre TEXT,
    metrica_valor REAL,
    metrica_unidad TEXT,
    duracion_ms REAL,
    snapshot_json TEXT,
    FOREIGN KEY (escenario_id) REFERENCES escenario(id) ON DELETE RESTRICT
);

-- Un método numérico aplicado dentro de una simulación.
CREATE TABLE IF NOT EXISTS ejecucion_metodo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    simulacion_id INTEGER NOT NULL,
    familia TEXT,
    metodo TEXT NOT NULL,
    tolerancia REAL,
    paso REAL,
    max_iter INTEGER,
    convergio INTEGER CHECK (convergio IN (0, 1)),
    tiempo_ms REAL,
    FOREIGN KEY (simulacion_id) REFERENCES simulacion(id) ON DELETE CASCADE
);

-- Detalle iteración a iteración (o refinamiento a refinamiento) para graficar convergencia.
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

-- Síntesis verificable de cada ejecución.
CREATE TABLE IF NOT EXISTS resultado_resumen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ejecucion_id INTEGER NOT NULL UNIQUE,
    referencia TEXT,
    valor_json TEXT NOT NULL,
    metrica_error_json TEXT,
    interpretacion TEXT,
    FOREIGN KEY (ejecucion_id) REFERENCES ejecucion_metodo(id) ON DELETE CASCADE
);

-- Prueba de reproducibilidad: ejecutar → guardar → recuperar → repetir → comparar con tolerancia.
CREATE TABLE IF NOT EXISTS verificacion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    simulacion_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    tolerancia REAL NOT NULL,
    aprobada INTEGER NOT NULL CHECK (aprobada IN (0, 1)),
    detalle_json TEXT,
    FOREIGN KEY (simulacion_id) REFERENCES simulacion(id) ON DELETE CASCADE
);

-- Registro de inserciones, modificaciones y eliminaciones realizadas desde el panel de base de datos.
CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    tabla TEXT NOT NULL,
    registro_id TEXT,
    operacion TEXT NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
    detalle TEXT
);

CREATE INDEX IF NOT EXISTS idx_escenario_caso ON escenario(caso_id, tipo);
CREATE INDEX IF NOT EXISTS idx_simulacion_fecha ON simulacion(fecha);
CREATE INDEX IF NOT EXISTS idx_simulacion_escenario ON simulacion(escenario_id);
CREATE INDEX IF NOT EXISTS idx_metodo_simulacion ON ejecucion_metodo(simulacion_id);
CREATE INDEX IF NOT EXISTS idx_iteracion_ejecucion ON iteracion_resultado(ejecucion_id, numero);
CREATE INDEX IF NOT EXISTS idx_verificacion_sim ON verificacion(simulacion_id);

CREATE VIEW IF NOT EXISTS vw_resumen_simulaciones AS
SELECT s.id AS simulacion_id, c.nombre AS caso, e.tipo AS escenario, s.fecha, s.estado, s.metrica_nombre, s.metrica_valor, s.metrica_unidad, COUNT(m.id) AS metodos
FROM simulacion s JOIN escenario e ON e.id = s.escenario_id JOIN caso_estudio c ON c.id = e.caso_id LEFT JOIN ejecucion_metodo m ON m.simulacion_id = s.id
GROUP BY s.id, c.nombre, e.tipo, s.fecha, s.estado, s.metrica_nombre, s.metrica_valor, s.metrica_unidad;

CREATE VIEW IF NOT EXISTS vw_convergencia_metodos AS
SELECT m.id AS ejecucion_id, s.id AS simulacion_id, c.nombre AS caso, e.tipo AS escenario, m.familia, m.metodo, m.convergio, COUNT(i.id) AS registros, MIN(i.error_abs) AS error_minimo, MIN(i.residual) AS residual_minimo
FROM ejecucion_metodo m JOIN simulacion s ON s.id = m.simulacion_id JOIN escenario e ON e.id = s.escenario_id JOIN caso_estudio c ON c.id = e.caso_id
LEFT JOIN iteracion_resultado i ON i.ejecucion_id = m.id GROUP BY m.id, s.id, c.nombre, e.tipo, m.familia, m.metodo, m.convergio;

INSERT OR IGNORE INTO caso_estudio(id, nombre, modelo_version) VALUES
  (1, 'Detención de emergencia', 'semana3-v1.0'),
  (2, 'Deterioro mecánico y mantenimiento', 'semana3-v1.0'),
  (3, 'Oscilaciones por viento', 'semana3-v1.0'),
  (4, 'Reconstrucción de sensores', 'semana3-v1.0');
