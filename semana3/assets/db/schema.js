/** Esquema relacional de SIMTELE-RISK: fuente única para el motor, el SQL generado y el DER. */
const col = (name, type, o = {}) => ({ name, type, ...o });
export const SCHEMA_VERSION = 3;
export const TABLES = {
  caso_estudio: {
    comment: 'Los cuatro casos de estudio obligatorios.',
    columns: [col('id', 'INTEGER', { pk: true }), col('nombre', 'TEXT', { notNull: true, unique: true }), col('modelo_version', 'TEXT', { notNull: true, default: 'semana3-v1.0' }), col('descripcion', 'TEXT')],
  },
  escenario: {
    comment: 'Parámetros reproducibles de cada escenario (NORMAL, ESTRÉS, MAL CONDICIONADO).',
    columns: [col('id', 'INTEGER', { pk: true, auto: true }), col('caso_id', 'INTEGER', { notNull: true, fk: { table: 'caso_estudio', column: 'id', onDelete: 'CASCADE' } }),
      col('tipo', 'TEXT', { notNull: true, check: ['NORMAL', 'ESTRÉS', 'MAL CONDICIONADO'] }), col('parametros_json', 'TEXT', { notNull: true, json: true }), col('fuente_datos', 'TEXT', { notNull: true, default: 'sintética educativa' })],
    unique: [['caso_id', 'tipo', 'parametros_json']],
  },
  simulacion: {
    comment: 'Una ejecución del laboratorio: escenario, fecha, estado y copia verificable del resultado.',
    columns: [col('id', 'INTEGER', { pk: true, auto: true }), col('escenario_id', 'INTEGER', { notNull: true, fk: { table: 'escenario', column: 'id', onDelete: 'RESTRICT' } }),
      col('fecha', 'TEXT', { notNull: true }), col('usuario_equipo', 'TEXT', { default: 'Equipo SIMTELE-RISK' }), col('estado', 'TEXT', { notNull: true, check: ['COMPLETADA', 'ERROR', 'EN_PROCESO'], default: 'COMPLETADA' }),
      col('etiqueta', 'TEXT'), col('notas', 'TEXT'), col('version_motor', 'TEXT'), col('metrica_nombre', 'TEXT'), col('metrica_valor', 'REAL'), col('metrica_unidad', 'TEXT'), col('duracion_ms', 'REAL'), col('snapshot_json', 'TEXT', { json: true })],
  },
  ejecucion_metodo: {
    comment: 'Un método numérico aplicado dentro de una simulación.',
    columns: [col('id', 'INTEGER', { pk: true, auto: true }), col('simulacion_id', 'INTEGER', { notNull: true, fk: { table: 'simulacion', column: 'id', onDelete: 'CASCADE' } }),
      col('familia', 'TEXT'), col('metodo', 'TEXT', { notNull: true }), col('tolerancia', 'REAL'), col('paso', 'REAL'), col('max_iter', 'INTEGER'), col('convergio', 'BOOLEAN', { check: [0, 1] }), col('tiempo_ms', 'REAL')],
  },
  iteracion_resultado: {
    comment: 'Detalle iteración a iteración (o refinamiento a refinamiento) para graficar convergencia.',
    columns: [col('id', 'INTEGER', { pk: true, auto: true }), col('ejecucion_id', 'INTEGER', { notNull: true, fk: { table: 'ejecucion_metodo', column: 'id', onDelete: 'CASCADE' } }),
      col('numero', 'INTEGER', { notNull: true }), col('aproximacion_json', 'TEXT', { notNull: true, json: true }), col('residual', 'REAL'), col('error_abs', 'REAL'), col('error_rel', 'REAL')],
    unique: [['ejecucion_id', 'numero']],
  },
  resultado_resumen: {
    comment: 'Síntesis verificable de cada ejecución.',
    columns: [col('id', 'INTEGER', { pk: true, auto: true }), col('ejecucion_id', 'INTEGER', { notNull: true, unique: true, fk: { table: 'ejecucion_metodo', column: 'id', onDelete: 'CASCADE' } }),
      col('referencia', 'TEXT'), col('valor_json', 'TEXT', { notNull: true, json: true }), col('metrica_error_json', 'TEXT', { json: true }), col('interpretacion', 'TEXT')],
  },
  verificacion: {
    comment: 'Prueba de reproducibilidad: ejecutar → guardar → recuperar → repetir → comparar con tolerancia.',
    columns: [col('id', 'INTEGER', { pk: true, auto: true }), col('simulacion_id', 'INTEGER', { notNull: true, fk: { table: 'simulacion', column: 'id', onDelete: 'CASCADE' } }),
      col('fecha', 'TEXT', { notNull: true }), col('tolerancia', 'REAL', { notNull: true }), col('aprobada', 'BOOLEAN', { notNull: true, check: [0, 1] }), col('detalle_json', 'TEXT', { json: true })],
  },
  auditoria: {
    comment: 'Registro de inserciones, modificaciones y eliminaciones realizadas desde el panel de base de datos.',
    columns: [col('id', 'INTEGER', { pk: true, auto: true }), col('fecha', 'TEXT', { notNull: true }), col('tabla', 'TEXT', { notNull: true }), col('registro_id', 'TEXT'),
      col('operacion', 'TEXT', { notNull: true, check: ['INSERT', 'UPDATE', 'DELETE'] }), col('detalle', 'TEXT')],
  },
};
export const TABLE_ORDER = ['caso_estudio', 'escenario', 'simulacion', 'ejecucion_metodo', 'iteracion_resultado', 'resultado_resumen', 'verificacion', 'auditoria'];
export const INDEXES = [
  ['idx_escenario_caso', 'escenario', ['caso_id', 'tipo']], ['idx_simulacion_fecha', 'simulacion', ['fecha']], ['idx_simulacion_escenario', 'simulacion', ['escenario_id']],
  ['idx_metodo_simulacion', 'ejecucion_metodo', ['simulacion_id']], ['idx_iteracion_ejecucion', 'iteracion_resultado', ['ejecucion_id', 'numero']], ['idx_verificacion_sim', 'verificacion', ['simulacion_id']],
];
export const VIEWS = {
  vw_resumen_simulaciones: `SELECT s.id AS simulacion_id, c.nombre AS caso, e.tipo AS escenario, s.fecha, s.estado, s.metrica_nombre, s.metrica_valor, s.metrica_unidad, COUNT(m.id) AS metodos
FROM simulacion s JOIN escenario e ON e.id = s.escenario_id JOIN caso_estudio c ON c.id = e.caso_id LEFT JOIN ejecucion_metodo m ON m.simulacion_id = s.id
GROUP BY s.id, c.nombre, e.tipo, s.fecha, s.estado, s.metrica_nombre, s.metrica_valor, s.metrica_unidad`,
  vw_convergencia_metodos: `SELECT m.id AS ejecucion_id, s.id AS simulacion_id, c.nombre AS caso, e.tipo AS escenario, m.familia, m.metodo, m.convergio, COUNT(i.id) AS registros, MIN(i.error_abs) AS error_minimo, MIN(i.residual) AS residual_minimo
FROM ejecucion_metodo m JOIN simulacion s ON s.id = m.simulacion_id JOIN escenario e ON e.id = s.escenario_id JOIN caso_estudio c ON c.id = e.caso_id
LEFT JOIN iteracion_resultado i ON i.ejecucion_id = m.id GROUP BY m.id, s.id, c.nombre, e.tipo, m.familia, m.metodo, m.convergio`,
};

export const pkOf = (t) => TABLES[t].columns.find((c) => c.pk).name;
export const sqlType = (c) => ({ INTEGER: 'INTEGER', REAL: 'REAL', TEXT: 'TEXT', BOOLEAN: 'INTEGER' }[c.type]);
const qv = (v) => (typeof v === 'string' ? `'${v.replaceAll("'", "''")}'` : String(v));
export function ddl(table) {
  const t = TABLES[table], parts = [];
  for (const c of t.columns) {
    let s = `    ${c.name} ${sqlType(c)}`;
    if (c.pk) s += ' PRIMARY KEY' + (c.auto ? ' AUTOINCREMENT' : '');
    if (c.notNull && !c.pk) s += ' NOT NULL';
    if (c.unique) s += ' UNIQUE';
    if (c.default !== undefined) s += ` DEFAULT ${qv(c.default)}`;
    if (c.check) s += ` CHECK (${c.name} IN (${c.check.map(qv).join(', ')}))`;
    parts.push(s);
  }
  for (const u of t.unique || []) parts.push(`    UNIQUE (${u.join(', ')})`);
  for (const c of t.columns) if (c.fk) parts.push(`    FOREIGN KEY (${c.name}) REFERENCES ${c.fk.table}(${c.fk.column}) ON DELETE ${c.fk.onDelete}`);
  return `CREATE TABLE IF NOT EXISTS ${table} (\n${parts.join(',\n')}\n);`;
}
export function fullDDL() {
  return ['PRAGMA foreign_keys = ON;', '', ...TABLE_ORDER.map((t) => `-- ${TABLES[t].comment}\n${ddl(t)}\n`),
    ...INDEXES.map(([n, t, cs]) => `CREATE INDEX IF NOT EXISTS ${n} ON ${t}(${cs.join(', ')});`), '',
    ...Object.entries(VIEWS).map(([n, q]) => `CREATE VIEW IF NOT EXISTS ${n} AS\n${q};\n`)].join('\n');
}
