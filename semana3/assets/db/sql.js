/** Mini intérprete SQL (subconjunto de SQLite) sobre SimteleDB: SELECT/JOIN/GROUP BY/ORDER/LIMIT, INSERT, UPDATE, DELETE, PRAGMA. */
import { TABLES, TABLE_ORDER, pkOf, VIEWS, fullDDL, ddl } from './schema.js';
import { DBError } from './engine.js';

const KW = new Set('SELECT DISTINCT FROM WHERE JOIN INNER LEFT ON AS AND OR NOT IN LIKE IS NULL BETWEEN ORDER BY GROUP HAVING LIMIT OFFSET ASC DESC INSERT INTO VALUES UPDATE SET DELETE PRAGMA COUNT SUM AVG MIN MAX'.split(' '));
function tokenize(sql) {
  const t = []; let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '-' && sql[i + 1] === '-') { while (i < sql.length && sql[i] !== '\n') i++; continue; }
    if (c === "'") { let s = ''; i++; while (i < sql.length) { if (sql[i] === "'") { if (sql[i + 1] === "'") { s += "'"; i += 2; continue; } break; } s += sql[i++]; } if (i >= sql.length) throw new DBError('Cadena sin cerrar.'); i++; t.push({ k: 'str', v: s }); continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(sql[i + 1]))) { const m = /^[0-9]*\.?[0-9]+(e[+-]?[0-9]+)?|^[0-9]+\./i.exec(sql.slice(i)); t.push({ k: 'num', v: Number(m[0]) }); i += m[0].length; continue; }
    if (/[A-Za-z_áéíóúñÁÉÍÓÚÑ]/.test(c)) { let j = i; while (j < sql.length && /[A-Za-z0-9_áéíóúñÁÉÍÓÚÑ]/.test(sql[j])) j++; const w = sql.slice(i, j); t.push({ k: KW.has(w.toUpperCase()) ? 'kw' : 'id', v: KW.has(w.toUpperCase()) ? w.toUpperCase() : w, raw: w }); i = j; continue; }
    const two = sql.slice(i, i + 2);
    if (['<=', '>=', '<>', '!=', '||'].includes(two)) { t.push({ k: 'op', v: two === '<>' ? '!=' : two }); i += 2; continue; }
    if ('=<>+-*/(),.;%'.includes(c)) { t.push({ k: 'op', v: c }); i++; continue; }
    throw new DBError(`Carácter no válido en SQL: «${c}»`);
  }
  return t;
}
class Parser {
  constructor(tokens) { this.t = tokens; this.i = 0; }
  peek(o = 0) { return this.t[this.i + o]; }
  next() { return this.t[this.i++]; }
  isKw(v, o = 0) { const x = this.peek(o); return x && x.k === 'kw' && x.v === v; }
  isOp(v, o = 0) { const x = this.peek(o); return x && x.k === 'op' && x.v === v; }
  eatKw(v) { if (this.isKw(v)) { this.i++; return true; } return false; }
  eatOp(v) { if (this.isOp(v)) { this.i++; return true; } return false; }
  expectKw(v) { if (!this.eatKw(v)) throw new DBError(`Se esperaba ${v}.`); }
  expectOp(v) { if (!this.eatOp(v)) throw new DBError(`Se esperaba «${v}».`); }
  ident() { const x = this.next(); if (!x || (x.k !== 'id' && x.k !== 'kw')) throw new DBError('Se esperaba un identificador.'); return x.raw ?? x.v.toLowerCase(); }
  /* expresiones */
  expr() { return this.or(); }
  or() { let l = this.and(); while (this.eatKw('OR')) l = { t: 'bin', op: 'OR', l, r: this.and() }; return l; }
  and() { let l = this.not(); while (this.eatKw('AND')) l = { t: 'bin', op: 'AND', l, r: this.not() }; return l; }
  not() { if (this.eatKw('NOT')) return { t: 'not', e: this.not() }; return this.cmp(); }
  cmp() {
    const l = this.add();
    if (this.isKw('IS')) { this.next(); const neg = this.eatKw('NOT'); this.expectKw('NULL'); return { t: 'isnull', e: l, neg }; }
    let neg = false; if (this.isKw('NOT') && (this.isKw('IN', 1) || this.isKw('LIKE', 1) || this.isKw('BETWEEN', 1))) { this.next(); neg = true; }
    if (this.eatKw('IN')) { this.expectOp('('); const list = [this.expr()]; while (this.eatOp(',')) list.push(this.expr()); this.expectOp(')'); return { t: 'in', e: l, list, neg }; }
    if (this.eatKw('LIKE')) return { t: 'like', e: l, p: this.add(), neg };
    if (this.eatKw('BETWEEN')) { const lo = this.add(); this.expectKw('AND'); const hi = this.add(); return { t: 'between', e: l, lo, hi, neg }; }
    const x = this.peek();
    if (x && x.k === 'op' && ['=', '!=', '<', '<=', '>', '>='].includes(x.v)) { this.next(); return { t: 'bin', op: x.v, l, r: this.add() }; }
    return l;
  }
  add() { let l = this.mul(); while (this.isOp('+') || this.isOp('-') || this.isOp('||')) { const op = this.next().v; l = { t: 'bin', op, l, r: this.mul() }; } return l; }
  mul() { let l = this.unary(); while (this.isOp('*') || this.isOp('/') || this.isOp('%')) { const op = this.next().v; l = { t: 'bin', op, l, r: this.unary() }; } return l; }
  unary() { if (this.eatOp('-')) return { t: 'bin', op: '-', l: { t: 'lit', v: 0 }, r: this.unary() }; return this.prim(); }
  prim() {
    const x = this.next(); if (!x) throw new DBError('Expresión incompleta.');
    if (x.k === 'num' || x.k === 'str') return { t: 'lit', v: x.v };
    if (x.k === 'kw' && x.v === 'NULL') return { t: 'lit', v: null };
    if (x.k === 'op' && x.v === '(') { const e = this.expr(); this.expectOp(')'); return e; }
    if ((x.k === 'kw' && ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].includes(x.v)) || (x.k === 'id' && this.isOp('('))) {
      const name = (x.raw ?? x.v).toUpperCase(); this.expectOp('(');
      let star = false, distinct = false, args = [];
      if (this.eatOp('*')) star = true; else { distinct = this.eatKw('DISTINCT'); if (!this.isOp(')')) { args.push(this.expr()); while (this.eatOp(',')) args.push(this.expr()); } }
      this.expectOp(')'); return { t: 'fn', name, star, distinct, args };
    }
    if (x.k === 'id') { if (this.eatOp('.')) { const c = this.next(); return { t: 'col', table: x.raw, name: c.k === 'op' && c.v === '*' ? '*' : (c.raw ?? c.v.toLowerCase()) }; } return { t: 'col', name: x.raw }; }
    throw new DBError(`Expresión no válida cerca de «${x.v}».`);
  }
}
const AGG = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX']);
const hasAgg = (e) => !!e && (e.t === 'fn' ? AGG.has(e.name) || e.args.some(hasAgg) : ['bin'].includes(e.t) ? hasAgg(e.l) || hasAgg(e.r) : e.t === 'not' ? hasAgg(e.e) : false);
const likeRe = (p) => new RegExp('^' + String(p).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'is');
const truthy = (v) => v !== null && v !== undefined && v !== false && v !== 0 && v !== '';
const cmpv = (a, b) => (a === b ? 0 : a < b ? -1 : 1);

function resolve(env, e) {
  if (e.table) { const k = `${e.table.toLowerCase()}.${e.name}`; if (!(k in env)) throw new DBError(`Columna desconocida: ${e.table}.${e.name}`); return env[k]; }
  const hits = Object.keys(env).filter((k) => k.endsWith('.' + e.name) && !k.startsWith('#'));
  if (!hits.length) { if (('#alias.' + e.name) in env) return env['#alias.' + e.name]; throw new DBError(`Columna desconocida: ${e.name}`); }
  const vals = new Set(hits.map((k) => env[k])); if (hits.length > 1 && hits.map((k) => k.split('.')[0]).length > 1 && vals.size > 1) throw new DBError(`Columna ambigua: ${e.name}`);
  return env[hits[0]];
}
function ev(e, env, group) {
  switch (e.t) {
    case 'lit': return e.v;
    case 'col': return resolve(env, e);
    case 'not': return truthy(ev(e.e, env, group)) ? 0 : 1;
    case 'isnull': { const v = ev(e.e, env, group); return (v === null || v === undefined) !== e.neg ? 1 : 0; }
    case 'in': { const v = ev(e.e, env, group); const r = e.list.some((x) => ev(x, env, group) === v); return r !== e.neg ? 1 : 0; }
    case 'like': { const v = ev(e.e, env, group), pat = ev(e.p, env, group); if (v === null) return null; return likeRe(pat).test(String(v)) !== e.neg ? 1 : 0; }
    case 'between': { const v = ev(e.e, env, group); const r = v >= ev(e.lo, env, group) && v <= ev(e.hi, env, group); return r !== e.neg ? 1 : 0; }
    case 'bin': {
      if (e.op === 'AND') return truthy(ev(e.l, env, group)) && truthy(ev(e.r, env, group)) ? 1 : 0;
      if (e.op === 'OR') return truthy(ev(e.l, env, group)) || truthy(ev(e.r, env, group)) ? 1 : 0;
      const a = ev(e.l, env, group), b = ev(e.r, env, group);
      if (['=', '!=', '<', '<=', '>', '>='].includes(e.op)) { if (a === null || b === null || a === undefined || b === undefined) return null; const c = cmpv(a, b); return ({ '=': c === 0, '!=': c !== 0, '<': c < 0, '<=': c <= 0, '>': c > 0, '>=': c >= 0 })[e.op] ? 1 : 0; }
      if (a === null || b === null) return null;
      switch (e.op) { case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return b === 0 ? null : a / b; case '%': return a % b; case '||': return String(a) + String(b); }
      break;
    }
    case 'fn': {
      if (AGG.has(e.name)) {
        if (!group) throw new DBError(`Función de agregación ${e.name} fuera de contexto.`);
        if (e.name === 'COUNT' && e.star) return group.length;
        let vals = group.map((g) => ev(e.args[0], g)).filter((v) => v !== null && v !== undefined);
        if (e.distinct) vals = [...new Set(vals)];
        if (e.name === 'COUNT') return vals.length;
        if (!vals.length) return null;
        if (e.name === 'SUM') return vals.reduce((s, v) => s + v, 0);
        if (e.name === 'AVG') return vals.reduce((s, v) => s + v, 0) / vals.length;
        if (e.name === 'MIN') return vals.reduce((m, v) => (v < m ? v : m));
        return vals.reduce((m, v) => (v > m ? v : m));
      }
      const a = e.args.map((x) => ev(x, env, group));
      switch (e.name) { case 'LENGTH': return a[0] === null ? null : String(a[0]).length; case 'UPPER': return String(a[0]).toUpperCase(); case 'LOWER': return String(a[0]).toLowerCase(); case 'ABS': return Math.abs(a[0]); case 'ROUND': return a[0] === null ? null : Number(a[0].toFixed(a[1] ?? 0)); case 'COALESCE': return a.find((v) => v !== null && v !== undefined) ?? null; case 'SUBSTR': return String(a[0]).substr(a[1] - 1, a[2]); default: throw new DBError(`Función no soportada: ${e.name}`); }
    }
  }
  throw new DBError('Expresión no soportada.');
}

export class SQL {
  constructor(db) { this.db = db; }
  async exec(text) {
    const t0 = performance.now(), stmts = splitStatements(text), results = [];
    for (const s of stmts) results.push(await this._one(s));
    const last = results.at(-1) || { columns: [], rows: [], message: 'Sin sentencias.' };
    return { ...last, all: results, timeMs: performance.now() - t0 };
  }
  /** Restaura un volcado .sql generado por esta app: reemplaza los datos ejecutando solo los INSERT, sin auditoría adicional. */
  async importDump(text) {
    const stmts = splitStatements(text).filter((s) => /^INSERT\s/i.test(s));
    if (!stmts.length) throw new DBError('El archivo no contiene sentencias INSERT.');
    await this.db.clearAll();
    await this.db.transaction(async () => {
      for (const st of stmts) {
        const p = new Parser(tokenize(st)); p.expectKw('INSERT'); p.expectKw('INTO'); const table = p.ident().toLowerCase(); if (!TABLES[table]) throw new DBError(`Tabla desconocida: ${table}`);
        p.expectOp('('); const cols = [p.ident()]; while (p.eatOp(',')) cols.push(p.ident()); p.expectOp(')'); p.expectKw('VALUES'); p.expectOp('(');
        const vals = [ev(p.expr(), {})]; while (p.eatOp(',')) vals.push(ev(p.expr(), {})); p.expectOp(')');
        this.db.insert(table, Object.fromEntries(cols.map((c, i) => [c, vals[i]])), { silent: true });
      }
    });
    return stmts.length;
  }
  async _one(sql) {
    const trimmed = sql.trim();
    if (/^\.tables$/i.test(trimmed)) return { columns: ['tabla', 'filas'], rows: TABLE_ORDER.map((t) => [t, this.db.count(t)]), message: '' };
    const sm = /^\.schema\s*(\w*)$/i.exec(trimmed);
    if (sm) { const t = sm[1]; return { columns: ['sql'], rows: [[t ? (TABLES[t] ? ddl(t) : 'Tabla desconocida') : fullDDL()]], message: '' }; }
    const p = new Parser(tokenize(trimmed));
    if (p.isKw('SELECT')) return this._select(p);
    if (p.eatKw('INSERT')) return this._insert(p);
    if (p.eatKw('UPDATE')) return this._update(p);
    if (p.eatKw('DELETE')) return this._delete(p);
    if (p.eatKw('PRAGMA')) return this._pragma(p);
    throw new DBError('Sentencia no soportada. Use SELECT, INSERT, UPDATE, DELETE, PRAGMA, .tables o .schema.');
  }
  _source(name) {
    const n = name.toLowerCase();
    if (TABLES[n]) return { cols: TABLES[n].columns.map((c) => c.name), rows: this.db.all(n) };
    if (VIEWS[n]) { const r = this._selectText(VIEWS[n]); return { cols: r.columns, rows: r.rows.map((row) => Object.fromEntries(r.columns.map((c, i) => [c, row[i]]))) }; }
    throw new DBError(`Tabla o vista desconocida: ${name}`);
  }
  _selectText(q) { return this._select(new Parser(tokenize(q))); }
  _select(p) {
    p.expectKw('SELECT'); const distinct = p.eatKw('DISTINCT'), items = [];
    do { if (p.isOp('*')) { p.next(); items.push({ star: true }); } else { const e = p.expr(); let alias = null; if (p.eatKw('AS')) alias = p.ident(); else if (p.peek()?.k === 'id') alias = p.ident(); items.push({ e, alias }); } } while (p.eatOp(','));
    p.expectKw('FROM');
    const base = p.ident(); let balias = base; if (p.eatKw('AS')) balias = p.ident(); else if (p.peek()?.k === 'id') balias = p.ident();
    const src = this._source(base);
    let envs = src.rows.map((r) => Object.fromEntries(src.cols.map((c) => [`${balias.toLowerCase()}.${c}`, r[c] ?? null])));
    const aliases = [{ alias: balias, cols: src.cols }];
    while (p.isKw('JOIN') || p.isKw('INNER') || p.isKw('LEFT')) {
      const left = p.eatKw('LEFT'); p.eatKw('INNER'); p.expectKw('JOIN');
      const tn = p.ident(); let al = tn; if (p.eatKw('AS')) al = p.ident(); else if (p.peek()?.k === 'id') al = p.ident();
      p.expectKw('ON'); const on = p.expr(); const s2 = this._source(tn); aliases.push({ alias: al, cols: s2.cols });
      const mk = (r) => Object.fromEntries(s2.cols.map((c) => [`${al.toLowerCase()}.${c}`, r?.[c] ?? null]));
      const out = [];
      // join hash si ON es una igualdad entre columnas
      if (on.t === 'bin' && on.op === '=' && on.l.t === 'col' && on.r.t === 'col') {
        const isNew = (c) => (c.table ? c.table.toLowerCase() === al.toLowerCase() : s2.cols.includes(c.name) && !envs[0]?.[`${aliases[0].alias.toLowerCase()}.${c.name}`] && false);
        let newSide = on.r, oldSide = on.l;
        if (on.l.table && on.l.table.toLowerCase() === al.toLowerCase()) { newSide = on.l; oldSide = on.r; }
        else if (!(on.r.table && on.r.table.toLowerCase() === al.toLowerCase())) { newSide = null; }
        if (newSide) {
          const idx = new Map(); for (const r of s2.rows) { const k = r[newSide.name]; if (!idx.has(k)) idx.set(k, []); idx.get(k).push(r); }
          for (const e of envs) { const m = idx.get(ev(oldSide, e)) || []; if (m.length) for (const r of m) out.push({ ...e, ...mk(r) }); else if (left) out.push({ ...e, ...mk(null) }); }
          envs = out; continue;
        }
      }
      for (const e of envs) { let hit = false; for (const r of s2.rows) { const m = { ...e, ...mk(r) }; if (truthy(ev(on, m))) { out.push(m); hit = true; } } if (!hit && left) out.push({ ...e, ...mk(null) }); }
      envs = out;
    }
    if (p.eatKw('WHERE')) { const w = p.expr(); envs = envs.filter((e) => truthy(ev(w, e))); }
    let groupBy = null, having = null;
    if (p.eatKw('GROUP')) { p.expectKw('BY'); groupBy = [p.expr()]; while (p.eatOp(',')) groupBy.push(p.expr()); }
    if (p.eatKw('HAVING')) having = p.expr();
    let order = [];
    if (p.eatKw('ORDER')) { p.expectKw('BY'); do { const e = p.expr(); const desc = p.eatKw('DESC'); if (!desc) p.eatKw('ASC'); order.push({ e, desc }); } while (p.eatOp(',')); }
    let limit = null, offset = 0;
    if (p.eatKw('LIMIT')) { limit = p.next().v; if (p.eatKw('OFFSET')) offset = p.next().v; else if (p.eatOp(',')) { offset = limit; limit = p.next().v; } }
    p.eatOp(';');
    if (p.peek()) throw new DBError(`Sintaxis inesperada cerca de «${p.peek().raw ?? p.peek().v}».`);
    // expandir *
    const sel = [];
    for (const it of items) {
      if (it.star) for (const a of aliases) for (const c of a.cols) sel.push({ e: { t: 'col', table: a.alias, name: c }, name: c });
      else if (it.e.t === 'col' && it.e.name === '*') { const a = aliases.find((x) => x.alias.toLowerCase() === it.e.table.toLowerCase()); if (!a) throw new DBError('Alias desconocido.'); for (const c of a.cols) sel.push({ e: { t: 'col', table: a.alias, name: c }, name: c }); }
      else sel.push({ e: it.e, name: it.alias || (it.e.t === 'col' ? it.e.name : it.e.t === 'fn' ? `${it.e.name.toLowerCase()}(${it.e.star ? '*' : it.e.args.map((a) => a.name ?? '…').join(',')})` : 'expr') });
    }
    const aggregated = groupBy || sel.some((s) => hasAgg(s.e)) || having;
    let rows;
    if (aggregated) {
      const groups = new Map();
      if (groupBy) for (const e of envs) { const k = JSON.stringify(groupBy.map((g) => ev(g, e))); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); }
      else groups.set('all', envs);
      rows = [];
      for (const g of groups.values()) {
        const rep = g[0] || {};
        if (having && !truthy(ev(having, rep, g))) continue;
        const o = { out: sel.map((s) => ev(s.e, rep, g)), keys: order.map((od) => { try { return ev(od.e, rep, g); } catch { return ev(od.e, Object.fromEntries(sel.map((s, i) => ['#alias.' + s.name, null])), g); } }) };
        rows.push(o);
      }
    } else {
      rows = envs.map((e) => { const out = sel.map((s) => ev(s.e, e)); const aliasEnv = { ...e }; sel.forEach((s, i) => { aliasEnv['#alias.' + s.name] = out[i]; }); return { out, keys: order.map((od) => ev(od.e, aliasEnv)) }; });
    }
    if (order.length) rows.sort((a, b) => { for (let i = 0; i < order.length; i++) { const x = a.keys[i], y = b.keys[i]; if (x === y) continue; if (x === null) return order[i].desc ? 1 : -1; if (y === null) return order[i].desc ? -1 : 1; const c = cmpv(x, y); return order[i].desc ? -c : c; } return 0; });
    let out = rows.map((r) => r.out);
    if (distinct) { const seen = new Set(); out = out.filter((r) => { const k = JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true; }); }
    const total = out.length; if (limit !== null) out = out.slice(offset, offset + limit); else if (offset) out = out.slice(offset);
    return { columns: sel.map((s) => s.name), rows: out, message: out.length < total ? `${out.length} fila(s) mostradas de ${total}` : `${total} fila(s)`, total };
  }
  async _insert(p) {
    p.expectKw('INTO'); const table = p.ident().toLowerCase(); if (!TABLES[table]) throw new DBError(`Tabla desconocida: ${table}`);
    let cols = TABLES[table].columns.map((c) => c.name);
    if (p.eatOp('(')) { cols = [p.ident()]; while (p.eatOp(',')) cols.push(p.ident()); p.expectOp(')'); }
    p.expectKw('VALUES'); const tuples = [];
    do { p.expectOp('('); const vals = [ev(p.expr(), {})]; while (p.eatOp(',')) vals.push(ev(p.expr(), {})); p.expectOp(')'); if (vals.length !== cols.length) throw new DBError('Número de valores distinto del de columnas.'); tuples.push(vals); } while (p.eatOp(','));
    let n = 0;
    await this.db.transaction(async () => { for (const v of tuples) { this.db.insert(table, Object.fromEntries(cols.map((c, i) => [c, v[i]]))); n++; } }, { audit: true });
    return { columns: [], rows: [], message: `${n} fila(s) insertada(s) en ${table}`, affected: n };
  }
  async _update(p) {
    const table = p.ident().toLowerCase(); if (!TABLES[table]) throw new DBError(`Tabla desconocida: ${table}`); p.expectKw('SET');
    const sets = []; do { const c = p.ident(); p.expectOp('='); sets.push([c, p.expr()]); } while (p.eatOp(','));
    const where = p.eatKw('WHERE') ? p.expr() : null; p.eatOp(';');
    const pk = pkOf(table), cols = TABLES[table].columns.map((c) => c.name);
    const targets = this.db.all(table).filter((r) => !where || truthy(ev(where, Object.fromEntries(cols.map((c) => [`${table}.${c}`, r[c]])))));
    let n = 0;
    await this.db.transaction(async () => { for (const r of targets) { const env = Object.fromEntries(cols.map((c) => [`${table}.${c}`, r[c]])); this.db.update(table, r[pk], Object.fromEntries(sets.map(([c, e]) => [c, ev(e, env)]))); n++; } }, { audit: true });
    return { columns: [], rows: [], message: `${n} fila(s) modificada(s) en ${table}`, affected: n };
  }
  async _delete(p) {
    p.expectKw('FROM'); const table = p.ident().toLowerCase(); if (!TABLES[table]) throw new DBError(`Tabla desconocida: ${table}`);
    const where = p.eatKw('WHERE') ? p.expr() : null; p.eatOp(';'); const pk = pkOf(table), cols = TABLES[table].columns.map((c) => c.name);
    const targets = this.db.all(table).filter((r) => !where || truthy(ev(where, Object.fromEntries(cols.map((c) => [`${table}.${c}`, r[c]])))));
    let n = 0;
    await this.db.transaction(async () => { for (const r of targets) { if (this.db.data[table].has(r[pk])) { this.db.delete(table, r[pk]); n++; } } }, { audit: true });
    return { columns: [], rows: [], message: `${n} fila(s) eliminada(s) de ${table} (con cascadas si corresponde)`, affected: n };
  }
  _pragma(p) {
    const name = p.ident().toLowerCase();
    if (name === 'foreign_key_check' || name === 'integrity_check') { const iss = this.db.integrityCheck(); return { columns: ['tabla', 'id', 'problema'], rows: iss.length ? iss.map((i) => [i.tabla, i.id, i.problema]) : [], message: iss.length ? `${iss.length} problema(s)` : 'Integridad correcta: sin violaciones.' }; }
    if (name === 'table_info') { p.expectOp('('); const t = p.ident().toLowerCase(); p.expectOp(')'); if (!TABLES[t]) throw new DBError('Tabla desconocida.'); return { columns: ['cid', 'name', 'type', 'notnull', 'pk'], rows: TABLES[t].columns.map((c, i) => [i, c.name, c.type, c.notNull ? 1 : 0, c.pk ? 1 : 0]), message: '' }; }
    throw new DBError('PRAGMA no soportado (use foreign_key_check, integrity_check o table_info(t)).');
  }
}
export function splitStatements(text) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i]; if (c === "'") q = !q; if (c === ';' && !q) { if (cur.trim()) out.push(cur.trim()); cur = ''; } else cur += c; }
  if (cur.trim()) out.push(cur.trim());
  return out.map((s) => s.replace(/^(--[^\n]*\n)+/g, '').trim()).filter(Boolean);
}
export const SAVED_QUERIES = [
  ['Resumen de simulaciones', 'SELECT * FROM vw_resumen_simulaciones ORDER BY simulacion_id DESC'],
  ['Convergencia por método', 'SELECT caso, escenario, metodo, convergio, registros, error_minimo FROM vw_convergencia_metodos ORDER BY caso, escenario, metodo LIMIT 100'],
  ['Simulaciones por caso y escenario', 'SELECT c.nombre AS caso, e.tipo AS escenario, COUNT(*) AS simulaciones\nFROM simulacion s JOIN escenario e ON e.id = s.escenario_id JOIN caso_estudio c ON c.id = e.caso_id\nGROUP BY c.nombre, e.tipo ORDER BY c.nombre'],
  ['Métodos con mayor error final', "SELECT m.metodo, r.referencia, r.metrica_error_json\nFROM ejecucion_metodo m JOIN resultado_resumen r ON r.ejecucion_id = m.id\nWHERE m.convergio = 1 ORDER BY m.id DESC LIMIT 20"],
  ['Iteraciones de una ejecución', 'SELECT numero, aproximacion_json, residual, error_abs FROM iteracion_resultado WHERE ejecucion_id = 1 ORDER BY numero'],
  ['Pruebas de reproducibilidad', 'SELECT v.id, v.simulacion_id, v.fecha, v.tolerancia, v.aprobada FROM verificacion v ORDER BY v.id DESC'],
  ['Auditoría reciente', 'SELECT fecha, tabla, registro_id, operacion, detalle FROM auditoria ORDER BY id DESC LIMIT 20'],
  ['Integridad referencial', 'PRAGMA foreign_key_check'],
];
