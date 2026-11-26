/** SimteleDB · motor relacional embebido: tablas tipadas, PK/FK/UNIQUE/CHECK, cascadas, transacciones, auditoría y persistencia. */
import { TABLES, TABLE_ORDER, pkOf, fullDDL, SCHEMA_VERSION } from './schema.js';

const now = () => new Date().toISOString();
export class DBError extends Error {}

/* ---------------- Adaptadores de almacenamiento ---------------- */
export class MemoryAdapter {
  constructor() { this.tables = {}; this.meta = {}; }
  async load() { return { tables: JSON.parse(JSON.stringify(this.tables)), meta: JSON.parse(JSON.stringify(this.meta)) }; }
  async commit(changes, meta) {
    for (const c of changes) {
      const t = (this.tables[c.table] ||= {});
      if (c.op === 'put') t[c.row[pkOf(c.table)]] = JSON.parse(JSON.stringify(c.row)); else delete t[c.id];
    }
    this.meta = JSON.parse(JSON.stringify(meta));
  }
  async clear() { this.tables = {}; this.meta = {}; }
}
export class IndexedDBAdapter {
  constructor(name = 'SIMTELE_RISK_DB') { this.name = name; this._db = null; }
  open() {
    if (!this._db) this._db = new Promise((res, rej) => {
      const rq = indexedDB.open(this.name, SCHEMA_VERSION);
      rq.onupgradeneeded = () => {
        const db = rq.result;
        for (const t of TABLE_ORDER) if (!db.objectStoreNames.contains(t)) db.createObjectStore(t, { keyPath: pkOf(t) });
        if (!db.objectStoreNames.contains('_meta')) db.createObjectStore('_meta', { keyPath: 'key' });
      };
      rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
    });
    return this._db;
  }
  async load() {
    const db = await this.open(), out = { tables: {}, meta: {} };
    const all = (store) => new Promise((res, rej) => { const r = db.transaction(store, 'readonly').objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    for (const t of TABLE_ORDER) { out.tables[t] = {}; for (const row of await all(t)) out.tables[t][row[pkOf(t)]] = row; }
    for (const m of await all('_meta')) out.meta[m.key] = m.value;
    return out;
  }
  async commit(changes, meta) {
    const db = await this.open(), names = [...new Set(changes.map((c) => c.table)), '_meta'];
    return new Promise((res, rej) => {
      const tx = db.transaction(names, 'readwrite');
      for (const c of changes) { const st = tx.objectStore(c.table); if (c.op === 'put') st.put(c.row); else st.delete(c.id); }
      const ms = tx.objectStore('_meta'); for (const [key, value] of Object.entries(meta)) ms.put({ key, value });
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
    });
  }
  async clear() {
    const db = await this.open();
    return new Promise((res, rej) => { const tx = db.transaction([...TABLE_ORDER, '_meta'], 'readwrite'); for (const n of [...TABLE_ORDER, '_meta']) tx.objectStore(n).clear(); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  }
}

/* ---------------- Motor ---------------- */
export class Database {
  constructor(adapter = new MemoryAdapter()) { this.adapter = adapter; this.data = {}; this.meta = { seq: {}, schema: SCHEMA_VERSION }; this._tx = null; this.ready = false; this.listeners = new Set(); }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit() { for (const fn of this.listeners) fn(); }

  async open() {
    const snap = await this.adapter.load();
    for (const t of TABLE_ORDER) this.data[t] = new Map(Object.values(snap.tables?.[t] || {}).map((r) => [r[pkOf(t)], r]));
    this.meta = { seq: {}, schema: SCHEMA_VERSION, ...(snap.meta || {}) }; this.meta.seq ||= {};
    for (const t of TABLE_ORDER) { const mx = Math.max(0, ...[...this.data[t].keys()].filter(Number.isFinite)); this.meta.seq[t] = Math.max(this.meta.seq[t] || 0, mx); }
    this.ready = true; return this;
  }
  /* --- transacciones: deshacen en memoria y envían cambios al adaptador al confirmar --- */
  async transaction(fn, { audit = false } = {}) {
    if (this._tx) return fn(this);
    this._tx = { undo: [], changes: [], audit, metaBefore: JSON.stringify(this.meta) };
    try {
      const out = await fn(this);
      const tx = this._tx; this._tx = null;
      if (tx.changes.length) await this.adapter.commit(tx.changes, this.meta);
      this._emit(); return out;
    } catch (e) {
      const tx = this._tx; this._tx = null;
      for (const u of tx.undo.reverse()) u();
      this.meta = JSON.parse(tx.metaBefore);
      throw e;
    }
  }
  _log(change, undo) { this._tx.changes.push(change); this._tx.undo.push(undo); }

  /* --- validación --- */
  _coerce(table, col, v, { partial = false } = {}) {
    if (v === undefined || v === null || v === '') { if (v === '' && col.type === 'TEXT' && !col.notNull) return null; return null; }
    switch (col.type) {
      case 'INTEGER': { const n = Number(v); if (!Number.isInteger(n)) throw new DBError(`${table}.${col.name} debe ser un entero.`); return n; }
      case 'REAL': { const n = Number(v); if (!Number.isFinite(n)) throw new DBError(`${table}.${col.name} debe ser un número.`); return n; }
      case 'BOOLEAN': { if (v === true || v === 'true' || v === '1' || v === 1) return 1; if (v === false || v === 'false' || v === '0' || v === 0) return 0; throw new DBError(`${table}.${col.name} debe ser 0 o 1.`); }
      default: {
        const s = String(v);
        if (col.json) { try { JSON.parse(s); } catch { throw new DBError(`${table}.${col.name} debe contener JSON válido.`); } }
        return s;
      }
    }
  }
  _validate(table, row) {
    const t = TABLES[table];
    for (const c of t.columns) {
      const v = row[c.name];
      if ((v === null || v === undefined) && c.notNull && !c.pk) throw new DBError(`${table}.${c.name} no puede ser nulo.`);
      if (v !== null && v !== undefined && c.check && !c.check.includes(v)) throw new DBError(`${table}.${c.name} debe ser uno de: ${c.check.join(', ')}.`);
      if (v !== null && v !== undefined && c.fk && !this.data[c.fk.table].has(v)) throw new DBError(`Clave foránea: no existe ${c.fk.table}.${c.fk.column} = ${v}.`);
    }
    const uniques = [...t.columns.filter((c) => c.unique).map((c) => [c.name]), ...(t.unique || [])];
    for (const u of uniques) for (const other of this.data[table].values()) {
      if (other[pkOf(table)] === row[pkOf(table)]) continue;
      if (u.every((k) => other[k] !== null && other[k] === row[k])) throw new DBError(`Restricción UNIQUE (${u.join(', ')}) violada en ${table}.`);
    }
  }
  _normalize(table, input, { forInsert }) {
    const t = TABLES[table], row = {};
    for (const c of t.columns) {
      let v = input[c.name];
      if (v === undefined && forInsert) { v = c.default !== undefined ? c.default : null; if (c.pk && c.auto) v = undefined; }
      if (v === undefined) continue;
      row[c.name] = this._coerce(table, c, v);
    }
    return row;
  }

  /* --- CRUD --- */
  insert(table, input, { silent = false } = {}) {
    if (!TABLES[table]) throw new DBError(`Tabla desconocida: ${table}`);
    const run = () => {
      const pk = pkOf(table), col = TABLES[table].columns.find((c) => c.pk), row = this._normalize(table, input, { forInsert: true });
      if (row[pk] === undefined || row[pk] === null) { if (!col.auto && !col.pk) throw new DBError('Falta la clave primaria.'); this.meta.seq[table] = (this.meta.seq[table] || 0) + 1; row[pk] = this.meta.seq[table]; }
      else { if (this.data[table].has(row[pk])) throw new DBError(`Clave primaria duplicada: ${table}.${pk} = ${row[pk]}`); this.meta.seq[table] = Math.max(this.meta.seq[table] || 0, row[pk]); }
      const ordered = {}; for (const c of TABLES[table].columns) ordered[c.name] = row[c.name] ?? null;
      this._validate(table, ordered);
      this.data[table].set(ordered[pk], ordered);
      this._log({ table, op: 'put', row: ordered }, () => this.data[table].delete(ordered[pk]));
      if (!silent && table !== 'auditoria' && this._tx?.audit) this._audit(table, ordered[pk], 'INSERT', JSON.stringify(ordered).slice(0, 300));
      return { ...ordered };
    };
    return this._tx ? run() : this.transaction(async () => run());
  }
  update(table, id, patch, opts = {}) {
    const run = () => {
      const old = this.data[table]?.get(id); if (!old) throw new DBError(`No existe ${table} con id ${id}.`);
      const pk = pkOf(table); if (patch[pk] !== undefined && patch[pk] !== id) throw new DBError('La clave primaria no se puede modificar.');
      const norm = this._normalize(table, patch, { forInsert: false });
      const row = { ...old, ...norm }; this._validate(table, row);
      this.data[table].set(id, row);
      this._log({ table, op: 'put', row }, () => this.data[table].set(id, old));
      if (table !== 'auditoria' && this._tx?.audit) { const diff = Object.keys(norm).filter((k) => old[k] !== row[k]).map((k) => `${k}: ${String(old[k]).slice(0, 40)} → ${String(row[k]).slice(0, 40)}`).join('; '); this._audit(table, id, 'UPDATE', diff || 'sin cambios'); }
      return { ...row };
    };
    return this._tx ? run() : this.transaction(async () => run(), opts);
  }
  _children(table, id) {
    const out = [];
    for (const [ct, def] of Object.entries(TABLES)) for (const c of def.columns) if (c.fk && c.fk.table === table) for (const r of this.data[ct].values()) if (r[c.name] === id) out.push({ table: ct, row: r, rule: c.fk.onDelete });
    return out;
  }
  /** Calcula cuántos registros dependientes se eliminarían en cascada (para confirmaciones). */
  cascadeCount(table, id, acc = {}) {
    for (const ch of this._children(table, id)) { if (ch.rule === 'RESTRICT') { acc._restrict = { table: ch.table, id: ch.row[pkOf(ch.table)] }; continue; } acc[ch.table] = (acc[ch.table] || 0) + 1; this.cascadeCount(ch.table, ch.row[pkOf(ch.table)], acc); }
    return acc;
  }
  delete(table, id, opts = {}) {
    const run = () => {
      const row = this.data[table]?.get(id); if (!row) throw new DBError(`No existe ${table} con id ${id}.`);
      const del = (t, r) => {
        const rid = r[pkOf(t)];
        for (const ch of this._children(t, rid)) {
          if (ch.rule === 'RESTRICT') throw new DBError(`No se puede eliminar ${t} #${rid}: ${ch.table} #${ch.row[pkOf(ch.table)]} depende de él (ON DELETE RESTRICT).`);
          del(ch.table, ch.row);
        }
        this.data[t].delete(rid);
        this._log({ table: t, op: 'delete', id: rid }, () => this.data[t].set(rid, r));
      };
      const cascade = this.cascadeCount(table, id);
      del(table, row);
      if (table !== 'auditoria' && this._tx?.audit) this._audit(table, id, 'DELETE', `Cascada: ${Object.entries(cascade).filter(([k]) => k !== '_restrict').map(([k, v]) => `${k}=${v}`).join(', ') || 'ninguna'}`);
      return { deleted: 1, cascade };
    };
    return this._tx ? run() : this.transaction(async () => run(), opts);
  }
  _audit(table, id, op, detail) {
    const row = { id: (this.meta.seq.auditoria = (this.meta.seq.auditoria || 0) + 1), fecha: now(), tabla: table, registro_id: String(id), operacion: op, detalle: detail };
    this.data.auditoria.set(row.id, row); this._log({ table: 'auditoria', op: 'put', row }, () => this.data.auditoria.delete(row.id));
  }

  /* --- consultas simples --- */
  get(table, id) { const r = this.data[table].get(id); return r ? { ...r } : null; }
  all(table) { return [...this.data[table].values()]; }
  count(table) { return this.data[table].size; }
  find(table, pred) { return this.all(table).filter(pred); }
  nextId(table) { return (this.meta.seq[table] || 0) + 1; }

  /* --- mantenimiento --- */
  integrityCheck() {
    const issues = [];
    for (const [t, def] of Object.entries(TABLES)) for (const row of this.data[t].values()) {
      for (const c of def.columns) {
        const v = row[c.name];
        if (c.fk && v !== null && !this.data[c.fk.table].has(v)) issues.push({ tabla: t, id: row[pkOf(t)], problema: `FK huérfana ${c.name}=${v} → ${c.fk.table}` });
        if (c.notNull && !c.pk && (v === null || v === undefined)) issues.push({ tabla: t, id: row[pkOf(t)], problema: `${c.name} nulo` });
        if (c.check && v !== null && !c.check.includes(v)) issues.push({ tabla: t, id: row[pkOf(t)], problema: `${c.name} fuera de CHECK` });
        if (c.json && v !== null) { try { JSON.parse(v); } catch { issues.push({ tabla: t, id: row[pkOf(t)], problema: `${c.name} JSON inválido` }); } }
      }
    }
    return issues;
  }
  stats() {
    const out = {}; let bytes = 0;
    for (const t of TABLE_ORDER) { const rows = this.all(t); const b = rows.reduce((s, r) => s + JSON.stringify(r).length, 0); out[t] = { rows: rows.length, bytes: b }; bytes += b; }
    return { tables: out, bytes, issues: this.integrityCheck().length };
  }
  async clearAll() { await this.adapter.clear(); for (const t of TABLE_ORDER) this.data[t] = new Map(); this.meta = { seq: {}, schema: SCHEMA_VERSION }; this._emit(); }

  /* --- exportación / importación --- */
  exportJSON() { return { app: 'SIMTELE-RISK', schema: SCHEMA_VERSION, exportedAt: now(), meta: this.meta, tables: Object.fromEntries(TABLE_ORDER.map((t) => [t, this.all(t)])) }; }
  async importJSON(obj, { replace = true } = {}) {
    if (!obj?.tables) throw new DBError('Archivo JSON sin tablas.');
    if (replace) await this.clearAll();
    await this.transaction(async () => {
      for (const t of TABLE_ORDER) for (const r of obj.tables[t] || []) this.insert(t, r, { silent: true });
    });
  }
  exportSQL({ ddl = true } = {}) {
    const q = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? (Number.isFinite(v) ? String(v) : 'NULL') : `'${String(v).replaceAll("'", "''")}'`);
    const lines = [`-- SIMTELE-RISK · volcado SQL (esquema v${SCHEMA_VERSION}) · ${now()}`, '-- Compatible con SQLite 3. Datos 100 % sintéticos.', ''];
    if (ddl) lines.push(fullDDL());
    lines.push('BEGIN TRANSACTION;');
    for (const t of TABLE_ORDER) {
      const cols = TABLES[t].columns.map((c) => c.name);
      for (const r of this.all(t)) lines.push(`INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map((c) => q(r[c])).join(', ')});`);
    }
    lines.push('COMMIT;', '');
    return lines.join('\n');
  }
}
